import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { initializeApp as initAdminApp, getApps, getApp, cert } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getRuntimeConfig } from "./src/server/runtimeConfig.ts";
import { errorHandler, logEvent, requestContext, requireAuth, requirePrincipal, requirePro, sendApiError, validateBody } from "./src/server/http.ts";
import { ApiError, isAllowedOrigin } from "./src/server/security.ts";
import { createEncryptionService } from "./src/server/crypto.ts";
import { isVerifiedPaystackTransaction, parsePaystackMetadata, verifyPaystackSignature } from "./src/server/payments.ts";
import { sanitizeLeadContact } from "./src/utils/leadSanitizer.ts";
import {
  chatAssistantSchema,
  checkoutSessionSchema,
  paystackVerifySchema,
  enrichLeadSchema,
  generateAnalysisSchema,
  generatePitchSchema,
  gmailConnectSchema,
  gmailDisconnectSchema,
  gmailReplyCheckSchema,
  gmailSendSchema,
  linkedinIntelligenceSchema,
  searchLeadsSchema,
  webAdaptabilitySchema,
} from "./src/server/schemas.ts";

dotenv.config();
const runtimeConfig = getRuntimeConfig(process.env);
if (runtimeConfig.isProduction && !process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is required in production.");
}

const app = express();

const PROVIDER_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(input: string | URL, init: RequestInit = {}, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(requestContext);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin, runtimeConfig.allowedOrigins)) {
      callback(null, true);
      return;
    }
    callback(new ApiError(403, "FORBIDDEN", "Origin is not allowed."));
  },
  credentials: false,
}));
app.use(express.json({
  limit: runtimeConfig.jsonBodyLimit,
  verify: (req, _res, buffer) => {
    (req as express.Request).rawBody = Buffer.from(buffer);
  },
}));
app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
}));

let db: any = null;
let adminAuth: ReturnType<typeof getAdminAuth> | null = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const configRaw = fs.readFileSync(configPath, "utf8");
    const firebaseConfig = JSON.parse(configRaw);
    
    // Initialize Admin SDK to run with service credentials (if defined for external hosting e.g. Render) or default credentials (bypassing rules)
    let adminApp;
    if (getApps().length === 0) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          adminApp = initAdminApp({
            credential: cert(serviceAccount),
            projectId: firebaseConfig.projectId
          });
          console.log("Firebase Admin initialized using FIREBASE_SERVICE_ACCOUNT environment key.");
        } catch (parseErr) {
          console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT. Falling back to default credentials:", parseErr);
          adminApp = initAdminApp({ projectId: firebaseConfig.projectId });
        }
      } else {
        adminApp = initAdminApp({ projectId: firebaseConfig.projectId });
      }
    } else {
      adminApp = getApp();
    }

    db = getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId || undefined);
    adminAuth = getAdminAuth(adminApp);
    logEvent("info", "firebase_admin_initialized", undefined, { hasServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT) });
  } else {
    console.warn("No firebase-applet-config.json configuration detected.");
  }
} catch (err) {
  console.error("Failed to initialize server-side Firestore instance:", err);
}

const hasApiKey = !!process.env.GEMINI_API_KEY;

// Verify or initialize Gemini
let ai: GoogleGenAI | null = null;
if (hasApiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Successfully initialized Gemini Client.");
  } catch (error) {
    console.error("Failed to initialize Gemini Client: ", error);
  }
} else {
  console.log("No GEMINI_API_KEY loaded. Server will run in fallback mock mode gracefully.");
}

const authenticate = requireAuth(async (token) => {
  if (!adminAuth) {
    throw new Error("Firebase Admin Auth is unavailable.");
  }
  return adminAuth.verifyIdToken(token, true);
});

app.use("/api", (req, res, next) => {
  if (req.path === "/config" || req.path === "/paystack/webhook") {
    next();
    return;
  }
  authenticate(req, res, next);
});

// API to check server status & mode
app.get("/api/config", (req, res) => {
  res.json({
      hasApiKey,
      demoMode: runtimeConfig.allowDemoMode,
      message: hasApiKey
      ? "Gemini API integration active." 
      : "Gemini API key is not configured. The app is running in offline demo mode."
  });
});

// Helper to generate beautifully tailored dynamic mock leads to prevent errors in any country, city & category
function generateDynamicMockLeads(city: string, country: string, category: string, platforms?: string[]): any[] {
  const activePlatforms = Array.isArray(platforms) && platforms.length > 0
    ? platforms
    : ["Google Maps", "Yelp", "LinkedIn", "Trustpilot", "Facebook Business", "YellowPages"];
  const normalizedCategory = category.charAt(0).toUpperCase() + category.slice(1);
  const cleanCity = city.charAt(0).toUpperCase() + city.slice(1);
  const cleanCountry = country.toUpperCase();

  const businessTemplates = [
    {
      namePrefix: ["Golden Slate", "Rustic Root", "Summit", "Apex", "Cornerstone", "Green Light", "Anchor", "Pioneer", "Enchanted"],
      nameSuffix: ["Co.", "Group", "Partners", "Hub", "Collective", "Haven", "Lab", "Works", ""],
      streetNames: ["Main St", "Congress Ave", "Broadway Rd", "Oak Lane", "High St", "Queen Road", "Pine Blvd", "Maple Ave", "Market Square"],
      noteTemplate: "A popular neighborhood spot with amazing local charm and strong word-of-mouth reputation. However, they lose up to 35% of high-value client opportunities because they have zero web page or online reservation system, relying only on shared directories."
    },
    {
      namePrefix: ["The Original", "Crafted", "Urban", "Metro", "Vanguard", "Starlight", "Beacon", "Heritage", "Sovereign"],
      nameSuffix: ["Studio", "Center", "Services", "Pro", "Solutions", "Depot", "HQ", "Station"],
      streetNames: ["Grand Avenue", "Park Lane", "Victoria Street", "Baker St", "Second Ave", "Lincoln High", "Sunset Blvd", "Elm Street"],
      noteTemplate: "A highly-rated establishment featuring excellent local reviews. They struggle to stand out in Google Search listings because competitors have modern, mobile-friendly landing pages and automated intake capabilities. Presenting them with a custom booking widget mockup would easily win this contract."
    },
    {
      namePrefix: ["Signature", "Fringe", "Wildwood", "Epicurean", "Bespoke", "Elite", "Horizon", "Ascent", "Centennial"],
      nameSuffix: ["Society", "Space", "Company", "Guild", "Foundry", "Network", "Bazaar", "Collective"],
      streetNames: ["Peachtree Rd", "Kensington Court", "Oxford Rd", "King St", "Mill Lane", "River Road", "Church Street", "Station Rd"],
      noteTemplate: "A well-established independent local provider. Currently doing bookings purely via telephone, making administrative scheduling extremely tedious for staff. A clean service-catalog page with a direct WhatsApp/Call-to-Action button would double their inquiry conversions."
    }
  ];

  // Pick suitable phone prefixes based on country keyword
  let phonePrefix = "+1";
  let phoneFormat = "555-";
  if (cleanCountry === "UK" || cleanCountry.includes("UNITED KINGDOM") || cleanCountry.includes("GB") || cleanCountry.includes("LONDON") || cleanCountry.includes("OXFORD")) {
    phonePrefix = "+44";
    phoneFormat = "20 7946 0";
  } else if (cleanCountry === "GERMANY" || cleanCountry.startsWith("DE") || cleanCountry.includes("DEUTSCHLAND") || cleanCountry.includes("MUNICH")) {
    phonePrefix = "+49";
    phoneFormat = "89 5550 ";
  } else if (cleanCountry === "CANADA" || cleanCountry.includes("TORONTO") || cleanCountry.includes("VANCOUVER")) {
    phonePrefix = "+1";
    phoneFormat = "416-555-";
  } else if (cleanCountry === "AUSTRALIA" || cleanCountry.includes("AU") || cleanCountry.includes("SYDNEY") || cleanCountry.includes("MELBOURNE")) {
    phonePrefix = "+61";
    phoneFormat = "2 9184 ";
  } else if (cleanCountry === "FRANCE" || cleanCountry.startsWith("FR") || cleanCountry.includes("PARIS")) {
    phonePrefix = "+33";
    phoneFormat = "1 42 27 ";
  }

  // Clean the category input from search indicators
  let displayCategory = normalizedCategory;
  if (displayCategory.toLowerCase().includes("newly opened")) {
    displayCategory = displayCategory.replace(/newly opened, recently listed|newly opened|recently listed/gi, '').trim();
  }
  // Trim rating instructions
  if (displayCategory.toLowerCase().includes("with excellent organic ratings")) {
    displayCategory = displayCategory.replace(/with excellent organic ratings and offline profile|with excellent organic ratings/gi, '').trim();
  }
  displayCategory = displayCategory.charAt(0).toUpperCase() + displayCategory.slice(1);

  return businessTemplates.map((tpl, index) => {
    const prefix = tpl.namePrefix[Math.floor(Math.random() * tpl.namePrefix.length)];
    const suffix = tpl.nameSuffix[Math.floor(Math.random() * tpl.nameSuffix.length)];
    const street = tpl.streetNames[Math.floor(Math.random() * tpl.streetNames.length)];
    const streetNum = Math.floor(Math.random() * 850) + 12;
    
    // Generate a beautiful business name
    let name = "";
    if (suffix) {
      name = `${prefix} ${displayCategory} ${suffix}`;
    } else {
      name = `${prefix} ${tpl.namePrefix[(index + 3) % tpl.namePrefix.length]} ${displayCategory}`;
    }

    const sourcePlatform = activePlatforms[index % activePlatforms.length] || "Demo generator";

    return {
      name,
      country,
      city: cleanCity,
      address: "Not publicly listed",
      category: displayCategory,
      phone: "No public phone number found",
      email: "Email not publicly listed",
      linkedin: "LinkedIn profile not publicly listed",
      socials: {
        facebook: "No public profile",
        instagram: "No public profile",
        twitter: "No public profile"
      },
      websiteStatus: "Not verified in demo fallback",
      verified: false,
      dataQuality: "synthetic",
      sourcePlatform,
      verificationScore: 0,
      notes: `Synthetic demo lead only. This record was generated locally and is not evidence that a real business exists. ${tpl.noteTemplate}`
    };
  });
}

// Shared sanitizer preserves missing-data markers and provenance instead of fabricating contacts.
function sanitizeServerLead(lead: any): any {
  return sanitizeLeadContact(lead);
}

// Search leads using Google Search Grounding with strict Zero Hallucination policy & multi-platform sources
app.post("/api/search-leads", validateBody(searchLeadsSchema), async (req, res) => {
  const { country, city, category, platforms } = req.body;

  if (!country || !city || !category) {
    return sendApiError(res, req, new ApiError(400, 'VALIDATION_ERROR', 'Country, city, and category are required.'));
  }

  const activePlatforms = Array.isArray(platforms) && platforms.length > 0
    ? platforms
    : ["Google Maps", "Yelp", "LinkedIn", "Trustpilot", "Facebook Business", "YellowPages"];
  const platformsStr = activePlatforms.join(", ");

  // If no API Key, serve beautiful mock results that closely match requested filters
  if (!ai) {
    if (!runtimeConfig.allowDemoMode) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'AI service is temporarily unavailable.'));
    }
    console.log(`Fallback mock leads returned for: ${category} in ${city}, ${country} across platforms: ${platformsStr}`);
    
    const results = generateDynamicMockLeads(city, country, category, activePlatforms);
    const tailoredResults = results.map((item, index) => ({
      ...item,
      id: `lead_mock_${Date.now()}_${index}`,
      status: "new",
      createdAt: new Date().toISOString()
    }));

    // artificial delay to feel like a real search
    await new Promise(resolve => setTimeout(resolve, 1500));
    return res.json({ leads: tailoredResults, source: "mock-database" });
  }

  try {
    const prompt = `Search the real-time web and local business directories including ${platformsStr} to identify up to 4 real, actually existing brick-and-mortar or local service businesses located in ${city}, ${country} in the business niche of "${category}" that lack a dedicated, modern professional website (they may only have a listing on ${platformsStr}).

STRICT ZERO-HALLUCINATION POLICY:
1. Every business MUST be a real, verifiable business currently operating in ${city}, ${country}. Never invent or fabricate business names.
2. Verified Phone Number: Provide the real public telephone number formatted for dialling. If NO public phone number can be verified, return exactly "No public phone number found" in plain language.
3. Contact Email Address: Return a public business email only when it is explicitly printed in the cited source. If no public email can be verified, return exactly "Email not publicly listed". Never infer, derive, or guess an email address.
4. LinkedIn Profile: Provide their real LinkedIn company or owner profile URL if publicly discoverable. If no LinkedIn profile is found, return exactly "LinkedIn profile not publicly listed".
5. Social Media: In the "socials" object, return real public profile URLs or handles for facebook, instagram, and twitter if found. If a platform is not found, set its value to "Not publicly listed".
6. Website Status: Describe their current web presence (e.g. "No official website - Google Maps / directory only", "Facebook page only", "Outdated or broken website").
7. Source Platform: Indicate the primary platform where this business profile was found (e.g. one of: ${platformsStr}).
8. Verification Score: Return an evidence-based integer from 0 to 100. Use 0 when no grounding citation supports the record; do not inflate confidence.
9. Notes: Factual description of what they do and why they need a modern landing page or booking portal.

You MUST return the results strictly as a valid, parsable JSON array. Do not write markdown code blocks or extra formatting.
Structure:
[
  {
    "name": "Exact Real Business Name",
    "country": "${country}",
    "city": "${city}",
    "address": "Accurate Street Address",
    "category": "${category}",
    "phone": "Verified Phone or 'No public phone number found'",
    "email": "Verified Email or 'Email not publicly listed'",
    "linkedin": "Verified LinkedIn URL or 'LinkedIn profile not publicly listed'",
    "socials": {
      "facebook": "URL or 'Not publicly listed'",
      "instagram": "URL or 'Not publicly listed'",
      "twitter": "URL or 'Not publicly listed'"
    },
    "websiteStatus": "No official website - Google Maps / directory only",
    "verified": false,
    "sourcePlatform": "Google Maps",
    "verificationScore": 95,
    "notes": "Factual description of their missing online presence and why they can benefit from a website"
  }
]`;

    let response;

    try {
      // First attempt: with Google Search Grounding to get real web assets
      response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          systemInstruction: "You are an expert lead generator for web designers. Enforce strict zero-hallucination policy: never guess missing email addresses or phone numbers; state plain language fallbacks. Your output must be purely valid JSON containing real entries with no prefix markdown formatting.",
        },
      });
    } catch (searchError: any) {
      logEvent('warn', 'google_grounding_unavailable', req, { errorName: searchError instanceof Error ? searchError.name : 'UnknownError' });
      throw new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Grounded lead discovery is temporarily unavailable.');
    }

    const text = response.text ? response.text.trim() : "[]";
    let leads = [];
    try {
      leads = JSON.parse(text);
    } catch (e) {
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      leads = JSON.parse(cleanText);
    }

    // A model response is only eligible for verified flags when grounding evidence exists.
    const citations = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    leads = leads.map((lead: any, index: number) => {
      const sanitized = sanitizeServerLead({
        ...lead,
        id: `lead_google_${Date.now()}_${index}`,
        sourcePlatform: lead.sourcePlatform || activePlatforms[index % activePlatforms.length] || "Google Maps",
        verificationScore: typeof lead.verificationScore === 'number' ? lead.verificationScore : 0,
        status: "new",
        createdAt: new Date().toISOString()
      });
      return citations.length > 0
        ? sanitized
        : { ...sanitized, verified: false, dataQuality: 'unverified', verificationScore: 0 };
    });

    res.json({ 
      leads, 
      source: "google-search-grounding",
      citations,
      warning: citations.length > 0 ? undefined : "No grounding citations were returned; treat these records as unverified."
    });
  } catch (error: any) {
    logEvent('warn', 'lead_discovery_provider_failed', req, { errorName: error instanceof Error ? error.name : 'UnknownError' });
    if (!runtimeConfig.allowDemoMode) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Lead discovery is temporarily unavailable.'));
    }
    // Development-only synthetic fallback; never present it as verified business data.
    const results = generateDynamicMockLeads(city, country, category, activePlatforms);
    const tailoredResults = results.map((item, index) => ({
      ...item,
      id: `lead_fallback_${Date.now()}_${index}`,
      status: "new",
      createdAt: new Date().toISOString(),
      notes: `${item.notes} (Temporary fallback query served due to search rate limits).`
    }));
    res.json({ leads: tailoredResults, source: "synthetic-demo-fallback", warning: "Synthetic demo data only; verify every record before contacting a business." });
  }
});

// Deep factual enrichment & social search endpoint using Google Search Grounding
app.post("/api/enrich-lead", validateBody(enrichLeadSchema), async (req, res) => {
  const { name, city, country, category } = req.body;

  if (!name || !city || !country) {
    return sendApiError(res, req, new ApiError(400, 'VALIDATION_ERROR', 'Business name, city, and country are required for enrichment.'));
  }

  if (!ai) {
    if (!runtimeConfig.allowDemoMode) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'AI service is temporarily unavailable.'));
    }
    return res.json({
      enriched: {
        name,
        city,
        country,
        category: category || "Local Business",
        phone: "No public phone number found",
        email: "Email not publicly listed",
        linkedin: "LinkedIn profile not publicly listed",
        socials: {
          facebook: "No public profile",
          instagram: "No public profile",
          twitter: "No public profile"
        },
        websiteStatus: "Not verified in demo fallback",
        verified: false,
        dataQuality: "synthetic",
        verificationSummary: "Synthetic demo response only; no live business details were verified."
      },
      source: "synthetic-demo-fallback",
      warning: "Synthetic demo data only; no live business details were verified."
    });
  }

  try {
    const prompt = `Perform a deep factual web investigation and social profile verification for the following local business:
Business Name: "${name}"
City: "${city}"
Country: "${country}"
Category/Niche: "${category || ''}"

STRICT ZERO-HALLUCINATION REQUIREMENT:
Search real-time web directories, Google Maps citations, LinkedIn, Facebook, Instagram, and local registries.
1. verifiedPhone: Provide their real public telephone number. If no public phone exists, return exactly "No public phone number found".
2. verifiedEmail: Return a public business email only when it is explicitly printed in a cited source. If no public email can be verified, return exactly "Email not publicly listed". Never infer, derive, or guess an email address.
3. linkedin: Return their real LinkedIn company or owner profile URL if found. If not found, return exactly "LinkedIn profile not publicly listed".
4. socials: Return real public URLs for facebook, instagram, and twitter if found. For any missing platform, return exactly "Not publicly listed".
5. websiteStatus: Describe their web presence accurately (e.g. "No official website - Google Maps / directory only", "Facebook page only", or URL if found).
6. verificationSummary: A 2-sentence factual summary of where this business is listed online and their web presence gap.

Return strictly a valid JSON object matching this schema without markdown code blocks:
{
  "name": "${name}",
  "city": "${city}",
  "country": "${country}",
  "phone": "Verified phone or 'No public phone number found'",
  "email": "Verified email or 'Email not publicly listed'",
  "linkedin": "Verified LinkedIn URL or 'LinkedIn profile not publicly listed'",
  "socials": {
    "facebook": "URL or 'Not publicly listed'",
    "instagram": "URL or 'Not publicly listed'",
    "twitter": "URL or 'Not publicly listed'"
  },
  "websiteStatus": "...",
  "verified": false,
  "verificationSummary": "..."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        systemInstruction: "You are an expert fact-checking business researcher. Never hallucinate or predict emails or phone numbers. If data is not publicly found, use clear plain language status messages."
      }
    });

    const text = response.text ? response.text.trim() : "{}";
    let enriched: any = {};
    try {
      enriched = JSON.parse(text);
    } catch (e) {
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      enriched = JSON.parse(cleanText);
    }

    const cleanEnriched = sanitizeServerLead({
      name,
      city,
      country,
      category,
      ...enriched
    });

    const citations = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    res.json({ enriched: cleanEnriched, citations, source: "google-search-grounding" });
  } catch (err: any) {
    logEvent('warn', 'lead_enrichment_provider_failed', req, { errorName: err instanceof Error ? err.name : 'UnknownError' });
    if (!runtimeConfig.allowDemoMode) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Lead enrichment is temporarily unavailable.'));
    }
    const fallbackEnriched = sanitizeServerLead({
      name,
      city,
      country,
      category: category || "Local Business",
      phone: "No public phone number found",
      email: "Email not publicly listed",
      linkedin: "LinkedIn profile not publicly listed",
      socials: {
        facebook: "No public profile",
        instagram: "No public profile",
        twitter: "No public profile"
      },
      websiteStatus: "Not verified in demo fallback",
      verified: false,
      dataQuality: "synthetic",
      verificationSummary: "Synthetic demo response only; no live business details were verified."
    });

    res.json({
      enriched: fallbackEnriched,
      source: "synthetic-demo-fallback",
      warning: "Synthetic demo data only; verify every detail before contacting a business."
    });
  }
});

// --- LinkedIn Company & Employee Intelligence Endpoint ---
app.post("/api/linkedin-intelligence", requirePro(() => db), validateBody(linkedinIntelligenceSchema), async (req, res) => {
  const { companyName, city, country, category } = req.body;
  if (!companyName) {
    return sendApiError(res, req, new ApiError(400, 'VALIDATION_ERROR', 'companyName is required.'));
  }

  try {
    if (!ai) {
    if (!runtimeConfig.allowDemoMode) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'AI service is temporarily unavailable.'));
    }
      throw new Error("AI engine unavailable");
    }

    const prompt = `You are a B2B LinkedIn Intelligence auditor. Research and verify the company profile and employee decision-makers for "${companyName}" in "${city}", "${country}" (${category}).
Return strictly valid JSON matching this schema without markdown block tags or markdown fences:
{
  "companyName": "${companyName}",
  "linkedinUrl": "https://www.linkedin.com/company/...",
  "employeeCountRange": "2-10 employees",
  "industry": "${category || 'Local Services'}",
  "verifiedSocialFootprint": true,
  "lastAuditedAt": "${new Date().toISOString()}",
  "summary": "...",
  "keyDecisionMakers": [
    {
      "name": "...",
      "role": "...",
      "department": "...",
      "profileUrl": "https://www.linkedin.com/search/results/people/?keywords=...",
      "verifiedStatus": "Verified Active"
    }
  ]
}
IMPORTANT: Do not hallucinate private personal emails or unlisted phones. Only report real or verified LinkedIn company footprint roles (e.g., Founder, Managing Owner, General Manager).`;

    const resp = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "You are a factual B2B LinkedIn auditor. Return pure JSON without markdown tags."
      }
    });

    const text = resp.text ? resp.text.trim() : "{}";
    const parsed = JSON.parse(text.replace(/```json/gi, '').replace(/```/g, '').trim());

    res.json({ companyIntelligence: parsed, source: "gemini" });
  } catch (err: any) {
    logEvent('warn', 'linkedin_provider_failed', req, { errorName: err instanceof Error ? err.name : 'UnknownError' });
    if (!runtimeConfig.allowDemoMode) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'LinkedIn intelligence is temporarily unavailable.'));
    }
    const cleanName = (companyName || 'Local Enterprise').trim();
    res.json({
      companyIntelligence: {
        companyName: cleanName,
        employeeCountRange: "Not publicly listed",
        industry: category || "Local Services & Retail",
        verifiedSocialFootprint: false,
        keyDecisionMakers: [],
        lastAuditedAt: new Date().toISOString(),
        summary: `Heuristic demo response only for ${cleanName}; no LinkedIn company or decision-maker details were verified.`
      },
      source: "heuristic-demo-fallback",
      warning: "Heuristic demo data only; verify every LinkedIn detail before outreach."
    });
  }
});

// --- Web Adaptability & Link Rot Monitor Endpoint ---
app.post("/api/web-adaptability-check", requirePro(() => db), validateBody(webAdaptabilitySchema), async (req, res) => {
  const { leadId, name, city, country, category, websiteStatus } = req.body;
  if (!name) {
    return sendApiError(res, req, new ApiError(400, 'VALIDATION_ERROR', 'name is required.'));
  }

  res.json({
    adaptability: {
      lastCheckedAt: new Date().toISOString(),
      status: "Not checked",
      detectedChanges: [],
      adaptabilityScore: 0
    },
    source: "unavailable-monitor",
    warning: "No web-monitoring provider is configured; no live website status was verified."
  });
});


// Fallback pitch generator helper
function generateFallbackPitch(lead: any, variant = "direct", language = "English") {
  const isGer = language?.toLowerCase() === "german";
  const isFre = language?.toLowerCase() === "french";
  const isSpa = language?.toLowerCase() === "spanish";
  const isIta = language?.toLowerCase() === "italian";

  let emailSubject = `Modernizing the Digital Presence for ${lead.name} in ${lead.city}`;
  let emailBody = `Dear ${lead.name} Team,

I'm a professional web developer located nearby, and I recently came across your listing for your outstanding ${lead.category} service. I noticed that online customers looking for you are currently guided solely to third party listings.

By launching a dedicated custom landing page with self-booking, professional custom contact forms, and client reviews, you can instantly turn web visits into revenue.

Would you be open to a brief 5-minute phone call to look at a free visual mockup we designed for you?

Best regards,
LeadFinder Outreach Consultant`;

  let phoneScript = `Hi there! I was looking up ${lead.category} services in ${lead.city} and came across ${lead.name}. Your local customer reviews look absolutely incredible! 

I noticed that you don't have a direct website online yet for booking/viewing details. I actually design responsive mobile pages for local owners to save them hours on telephone scheduling. If I sent you a quick, free visual draft I made of what your business website could look like, would you be open to taking a look?`;

  let valueProposition = `${lead.name} already commands high local quality. By adding a website, they can automate inquiries, capture search results from google maps, and double their client engagement with an elegant digital portal.`;

  let suggestedFeatures = [
    "Online Booking & Scheduling Portal",
    "Mobile-responsive Contact Forms",
    "Interactive Menu / Portfolios",
    "Google Maps & Customer Review Slider"
  ];

  if (variant === "value-first") {
    emailSubject = `Providing a Free Competitive SEO & SWOT Audit for ${lead.name}`;
    emailBody = `Dear ${lead.name} Team,

I've put together a complimentary regional SWOT analysis and local SEO rank report for your ${lead.category} business in ${lead.city}. 

Specifically, we identified three major competitor advantages you could easily bypass by adding an independent reservation landing page and direct client review funnels. 

I'd love to send over the full report and live layout mockup. Is there a good email or phone line to send this over?

Best,
LeadsRadar Specialist`;
  } else if (variant === "question-based") {
    emailSubject = `Quick question about local search rankings in ${lead.city} for ${lead.name}`;
    emailBody = `Dear ${lead.name} Team,

I notice that when customers search for high-quality ${lead.category} services in ${lead.city}, your competitor listings are occupying the top web ranks while your brand is hidden from the map. 

Is this a deliberate choice to limit incoming digital customer flows, or would you be open to a brief look at an automated map rank setup that would place your phone line and booking system directly on the first page?

Best regards,
Outreach Partner`;
  } else if (variant === "warm_consultant") {
    emailSubject = `Loved checking out ${lead.name} in ${lead.city} – quick thought!`;
    emailBody = `Hi ${lead.name} team! 👋

I was looking through local businesses in ${lead.city} today and your ${lead.category} services really stood out. I love how genuine your customer reviews are!

I did notice one thing that could make life much easier for you and your clients: adding a clean, 24/7 mobile reservation page so customers can book directly without waiting for a callback.

I put together a quick mockup design of what that could look like. Would you be open to taking a peek anytime this week? No pressure at all!

Warmly,
Your Local Growth Partner`;
    phoneScript = `Hi there! I was looking at ${lead.name}'s customer reviews today and love what you're doing in ${lead.city}! I noticed you don't have an online booking link yet—I actually built a free demo layout for you so customers can schedule online. Would you be open to checking it out?`;
  } else if (variant === "direct_founder") {
    emailSubject = `Founder note: 10x booking conversion for ${lead.name}`;
    emailBody = `Hi ${lead.name} team,

Direct note from founder to founder: we specialize in helping high-rated ${lead.category} businesses in ${lead.city} turn Google Maps visits into instant booked appointments.

Without a direct booking domain, you are losing ~30% of mobile inquiries to competitors. We build custom pages with zero upfront cost.

Can I send over a 60-second video demo showing how it works?

Best,
Founder @ LeadsRadar`;
    phoneScript = `Hey! This is Alex calling real quick. I love ${lead.name}'s reputation in ${lead.city}. I saw you're still relying on phone bookings—we build instant online reservation pages that save owners 5 hours a week. Can I text you our 60-second walkthrough?`;
  } else if (variant === "local_neighbor") {
    emailSubject = `Neighbor note for ${lead.name} here in ${lead.city} 🏡`;
    emailBody = `Hi ${lead.name} team,

I'm a local digital specialist right here in the ${lead.city} area. I've heard great things about your ${lead.category} work!

I love supporting local favorites, and I noticed your Google Maps listing doesn't link out to a direct reservation portal yet. I built a custom, beautiful draft for you as a local courtesy.

Would you have 3 minutes for a quick neighborly chat to see it?

Best,
Your ${lead.city} Digital Neighbor`;
    phoneScript = `Hi! I'm a local digital neighbor here in ${lead.city} and love ${lead.name}. I noticed your business didn't have a direct mobile reservation page on Maps—I built a clean prototype for you. Can I share the link with you?`;
  } else if (variant === "loom_video_script") {
    emailSubject = `Made a 60-second Loom video walkthrough for ${lead.name} 🎥`;
    emailBody = `Hi ${lead.name} team,

Instead of a long email, I recorded a quick 60-second video walkthrough showing exactly how customers in ${lead.city} search for ${lead.category} on their phones—and why a simple self-booking page could double your weekend reservations.

[Click here to watch your 60-sec Loom video audit]

Let me know if you'd like me to activate this prototype for you!

Cheers,
LeadsRadar Specialist`;
    phoneScript = `Hi there! I just sent a 60-second Loom video to your email showing how a quick mobile booking page can double your weekend reservations. Did you happen to see it yet?`;
  } else if (variant === "audio_voiceover") {
    emailSubject = `🎙️ Audio Note: Quick growth tip for ${lead.name}`;
    emailBody = `Hi ${lead.name} team,

I recorded a short 45-second voice note sharing three ways ${lead.name} can capture more organic map customers in ${lead.city} without spending a dollar on ads.

Key takeaway: adding an instant booking calendar to your profile increases after-hours reservations by 34%.

Would you like me to send over the voice note and live prototype link?

Best regards,
LeadsRadar Audio Coach`;
    phoneScript = `Hi! I left a short 45-second voice note for ${lead.name}'s team about automating your weekend bookings. Would it be okay if I texted you the link to listen?`;
  }

  // Basic localized translations for high-fidelity fallbacks
  if (isGer) {
    emailSubject = `Digitalisierung & Online-Buchung für ${lead.name} in ${lead.city}`;
    if (variant === "value-first") {
      emailSubject = `Kostenlose SEO- & SWOT-Analyse für Ihr Geschäft: ${lead.name}`;
    } else if (variant === "question-based") {
      emailSubject = `Kurze Frage zu Ihren Google-Suchplatzierungen in ${lead.city}`;
    }
    emailBody = `Sehr geehrtes Team von ${lead.name},

wir haben eine lokale Wettbewerbsanalyse für Ihr ${lead.category}-Geschäft erstellt. Uns ist aufgefallen, dass Sie noch über keine eigene Website verfügen, wodurch wertvolle Buchungen verloren gehen.

Mit einer eigenen mobilen Website können Sie Ihre Anfragen automatisieren und direkt neue Kunden gewinnen.

Hätten Sie Zeit für ein kurzes 5-Minuten-Telefonat, um unseren kostenlosen Entwurf anzusehen?

Mit freundlichen Grüßen,
LeadsRadar Partner`;
    phoneScript = `Hallo! Ich habe nach ${lead.category} in ${lead.city} gesucht und ${lead.name} gefunden. Ihre Bewertungen sind hervorragend! Haben Sie Interesse an einem kurzen Entwurf für eine eigene Buchungswebsite?`;
    valueProposition = `${lead.name} erzielt bereits hohe lokale Qualität. Mit einer Website können Sie Reservierungen automatisieren und die Sichtbarkeit verdoppeln.`;
    suggestedFeatures = ["Online-Buchung & Terminkalender", "Mobil-optimiertes Kontaktformular", "Google Maps Bewertungsslider", "Speisekarte / Servicekatalog"];
  } else if (isFre) {
    emailSubject = `Moderniser la présence numérique de ${lead.name} à ${lead.city}`;
    emailBody = `Bonjour à l'équipe de ${lead.name},

Nous avons remarqué que vous n'avez pas de site internet direct pour votre service de ${lead.category} à ${lead.city}. Vous perdez des clients au profit de plateformes tierces.

Avec un site moderne et un système de réservation directe, vous pouvez augmenter votre chiffre d'affaires.

Seriez-vous disponible pour un appel de 5 minutes ?

Cordialement,
L'équipe LeadsRadar`;
  } else if (isSpa) {
    emailSubject = `Modernizar la presencia digital de ${lead.name} en ${lead.city}`;
    emailBody = `Hola equipo de ${lead.name},

Hemos visitado su negocio de ${lead.category} en ${lead.city} y notamos que no cuenta con un sitio web oficial. Los clientes digitales no pueden reservar directamente.

Con una página web optimizada para móviles, usted podrá recibir reservas automáticas las 24 horas.

¿Tendría 5 minutos para hablar?

Saludos cordiales,
LeadsRadar`;
  } else if (isIta) {
    emailSubject = `Digitalizzazione e prenotazioni online per ${lead.name} a ${lead.city}`;
    emailBody = `Gentile team di ${lead.name},

Siamo esperti di marketing digitale per attività locali. Abbiamo analizzato la vostra presenza a ${lead.city} per la categoria ${lead.category}. 

Inserendo un sistema di prenotazione diretta e recensioni integrate, potrete raddoppiare i clienti.

Siete liberi per una breve telefonata di 5 minuti?

Cordiali saluti,
LeadsRadar`;
  }

  return {
    emailSubject,
    emailBody,
    phoneScript,
    valueProposition,
    suggestedFeatures
  };
}

// Generate pitch package
app.post("/api/generate-pitch", requirePro(() => db), validateBody(generatePitchSchema), async (req, res) => {
  const { lead, variant = "direct", language = "English" } = req.body;

  if (!lead) {
    return sendApiError(res, req, new ApiError(400, 'VALIDATION_ERROR', 'Lead object is required.'));
  }

  if (!ai) {
    if (!runtimeConfig.allowDemoMode) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'AI service is temporarily unavailable.'));
    }
    const promptValueMock = generateFallbackPitch(lead, variant, language);
    await new Promise(resolve => setTimeout(resolve, 800));
    return res.json({ pitch: promptValueMock, source: "mock" });
  }

  try {
    const prompt = `You are an expert digital sales copywriter. Generate a personalized sales pitch optimization.
Target Business Information:
Business Name: ${lead.name}
Country: ${lead.country}
City: ${lead.city}
Category: ${lead.category}
Key Details: ${lead.notes}

Selected Settings:
Tone Variant: ${variant} (if 'warm_consultant' use a warm, friendly, human-centric agency partner tone; if 'direct_founder' use authentic founder-to-founder language without corporate speak; if 'local_neighbor' emphasize proximity and neighborhood trust; if 'loom_video_script' format as a 60-second conversational Loom video walkthrough script; if 'audio_voiceover' format as an audio voiceover outline; direct means clear transactional B2B, value-first means leading with complimentary local insights or audits, question-based means starting with an engaging diagnostic ranking question).
Target Language: ${language} (translate subject, body, script, value proposition and features list into ${language}).

Provide:
1. A highly catchy transactional subject line (translate to ${language}).
2. An elegant, personalized, short, friendly sales outreach pitch email (translate to ${language}).
3. A respectful, non-pushy phone pitch script (translate to ${language}).
4. A concise 2-sentence Value Proposition (translate to ${language}).
5. An array of exactly 4 recommended website features (translate to ${language}).

Return strictly a valid raw JSON object matching the following Schema. Do not include markdown blocks, tags or wrap:
{
  "emailSubject": "...",
  "emailBody": "...",
  "phoneScript": "...",
  "valueProposition": "...",
  "suggestedFeatures": ["...", "...", "...", "..."]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "You are a sales engineer. Generate engaging B2B packages in pure JSON format without wrapping. Translate all fields text content to the requested target language.",
      }
    });

    const text = response.text ? response.text.trim() : "{}";
    let pitch = {};
    try {
      pitch = JSON.parse(text);
    } catch (e) {
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      pitch = JSON.parse(cleanText);
    }

    res.json({ pitch, source: "gemini" });
  } catch (error: any) {
    logEvent('warn', 'pitch_provider_failed', req, { errorName: error instanceof Error ? error.name : 'UnknownError' });
    if (!runtimeConfig.allowDemoMode) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Pitch generation is temporarily unavailable.'));
    }
    const fallbackPitch = generateFallbackPitch(lead, variant, language);
    res.json({ pitch: fallbackPitch, source: "synthetic-demo-fallback", warning: "Synthetic demo copy only; review every factual claim before sending." });
  }
});

// Create subscription Paystack checkout session (falls back to local sandbox in preview mode if secret missing or mismatched)
app.post("/api/paystack/create-checkout-session", validateBody(checkoutSessionSchema), async (req, res) => {
  const { period } = req.body;
  const principal = requirePrincipal(req);
  const paystackEmail = principal.email;
  const successUrl = new URL('/billing-success', runtimeConfig.appUrl).toString();
  const cancelUrl = new URL('/', runtimeConfig.appUrl).toString();
  const hasPaystackKey = !!process.env.PAYSTACK_SECRET_KEY;

  if (!paystackEmail || !paystackEmail.includes('@')) {
    return sendApiError(res, req, new ApiError(422, 'VALIDATION_ERROR', 'A verified account email is required for checkout.'));
  }

  if (!hasPaystackKey) {
    if (!runtimeConfig.allowDemoMode) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Payment service is temporarily unavailable.'));
    }
    return res.json({
      isMock: true,
      url: `/checkout-sandbox?period=${period}&success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`
    });
  }

  try {
    let currency = process.env.PAYSTACK_CURRENCY;

    // Proactively auto-detect the merchant's currency to avoid currency/channel mismatches
    try {
      const balanceResponse = await fetchWithTimeout("https://api.paystack.co/balance", {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        }
      });
      if (balanceResponse.ok) {
        const balanceData = (await balanceResponse.json()) as any;
        if (balanceData.status && Array.isArray(balanceData.data) && balanceData.data.length > 0) {
          // Find first available currency
          const detectedCurrency = balanceData.data[0]?.currency;
          if (detectedCurrency) {
            currency = detectedCurrency;
            console.log(`Auto-detected Paystack merchant currency from balance API: ${currency}`);
          }
        }
      } else {
        console.warn(`Paystack balance endpoint returned status ${balanceResponse.status}. Using environment currency placeholder.`);
      }
    } catch (detectErr) {
      console.error("Could not auto-detect Paystack account currency, falling back to configuration:", detectErr);
    }

    // Default currency if none matches
    if (!currency) {
      currency = "NGN";
    }

    const cur = currency.toUpperCase();
    let finalAmount = period === 'year' ? 640000 : 70000; // standard equivalent default (6,400 or 700 in base cents/pesewas)
    
    // Scale amount precisely to the native base transaction scale of the detected currency
    if (cur === "NGN") {
      finalAmount = period === 'year' ? 9000000 : 1000000; // 90,000 NGN or 10,000 NGN
    } else if (cur === "USD") {
      finalAmount = period === 'year' ? 6400 : 700; // 64 USD or 7 USD
    } else if (cur === "GHS") {
      finalAmount = period === 'year' ? 90000 : 10000; // 900 GHS or 100 GHS in pesewas
    } else if (cur === "KES") {
      finalAmount = period === 'year' ? 900000 : 100000; // 9,000 KES or 1,000 KES in cents
    } else if (cur === "ZAR") {
      finalAmount = period === 'year' ? 130000 : 15000; // 1,300 ZAR or 150 ZAR in cents
    }

    logEvent("info", "paystack_checkout_initialized", req, { amount: finalAmount, currency: cur, period });

    let response = await fetchWithTimeout("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: paystackEmail,
        amount: finalAmount,
        currency: cur,
        callback_url: successUrl,
        metadata: {
          tier: 'pro',
          period,
          uid: principal.uid
        }
      })
    });

    // Handle channel/currency mismatched configurations automatically as defensive backup
    if (!response.ok) {
      const errText = await response.text();
      let parsedErr: any = {};
      try { parsedErr = JSON.parse(errText); } catch (e) {}

      const errMsg = (parsedErr.message || "").toLowerCase();
      const isChannelOrCurrencyError = errMsg.includes("channel") || errMsg.includes("currency") || errMsg.includes("param");

      if (isChannelOrCurrencyError) {
        console.warn("Paystack channel/currency mismatches during init. Retrying with default dashboard settings...");
        
        // Let Paystack default the currency, but reset amount to its base pricing scale to avoid huge charged units
        const fallbackAmount = period === 'year' ? 70000 : 10000; // 70,000 or 10,000 safe minimum default
        response = await fetchWithTimeout("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: paystackEmail,
            amount: fallbackAmount,
            callback_url: successUrl,
            metadata: {
              tier: 'pro',
              period,
              uid: principal.uid
            }
          })
        });
      } else {
        throw new Error(parsedErr.message || `Paystack API status ${response.status}: ${errText}`);
      }
    }

    // Recheck response status after potential retry
    if (!response.ok) {
      const finalErrText = await response.text();
      let parsedFinalErr: any = {};
      try { parsedFinalErr = JSON.parse(finalErrText); } catch (e) {}
      throw new Error(parsedFinalErr.message || `Paystack API status ${response.status}: ${finalErrText}`);
    }

    const resJson = (await response.json()) as any;
    if (resJson.status && resJson.data?.authorization_url) {
      res.json({ url: resJson.data.authorization_url, isMock: false });
    } else {
      throw new Error(resJson.message || "Failed to retrieve checkout URL from Paystack.");
    }
  } catch (err: any) {
    logEvent("error", "paystack_checkout_failed", req, { errorName: err instanceof Error ? err.name : 'UnknownError' });
    if (!runtimeConfig.allowDemoMode) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Payment service is temporarily unavailable.'));
    }
    const sandboxUrl = `/checkout-sandbox?period=${period}&success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`;
    res.json({ url: sandboxUrl, isMock: true, warning: 'Payment service unavailable; development sandbox returned.' });
  }
});

async function grantProSubscription(transactionData: any, uid: string, period: 'month' | 'year'): Promise<void> {
  if (!db) {
    throw new Error('Firestore server is not configured.');
  }
  const reference = typeof transactionData.reference === 'string' ? transactionData.reference : '';
  if (!reference) {
    throw new Error('Payment reference is missing.');
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (period === 'year' ? 365 : 30));
  const userRef = db.collection('users').doc(uid);

  await db.runTransaction(async (transaction: any) => {
    const snapshot = await transaction.get(userRef);
    const existing = snapshot.data() || {};
    if (existing.lastPaymentReference === reference && existing.subscriptionTier === 'pro') {
      return;
    }
    transaction.set(userRef, {
      subscriptionTier: 'pro',
      subscriptionPeriod: period,
      subscriptionId: reference,
      lastPaymentReference: reference,
      trialExpires: expiresAt.toISOString(),
      subscriptionSource: 'paystack',
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
}

app.post("/api/paystack/verify", validateBody(paystackVerifySchema), async (req, res) => {
  const principal = requirePrincipal(req);
  const { reference } = req.body;

  if (!process.env.PAYSTACK_SECRET_KEY) {
    if (runtimeConfig.allowDemoMode && reference.startsWith('sandbox_')) {
      await grantProSubscription({ reference, status: 'success', customer: { email: principal.email }, metadata: { uid: principal.uid, tier: 'pro' } }, principal.uid, 'month');
      return res.json({ verified: true, mode: 'sandbox' });
    }
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Payment service is temporarily unavailable.'));
  }

  try {
    const response = await fetchWithTimeout(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const payload = await response.json() as { status?: boolean; data?: any };
    if (!response.ok || !payload.status || !payload.data) {
      return sendApiError(res, req, new ApiError(402, 'PAYMENT_REQUIRED', 'Payment could not be verified.'));
    }

    const metadata = parsePaystackMetadata(payload.data.metadata);
    const period = metadata.period === 'year' ? 'year' : 'month';
    if (!isVerifiedPaystackTransaction(payload.data, { uid: principal.uid, email: principal.email, tier: 'pro' })) {
      return sendApiError(res, req, new ApiError(403, 'FORBIDDEN', 'Payment does not belong to this account.'));
    }

    await grantProSubscription(payload.data, principal.uid, period);
    logEvent('info', 'paystack_payment_verified', req, { period });
    return res.json({ verified: true, mode: 'paystack' });
  } catch (error) {
    logEvent('error', 'paystack_payment_verification_failed', req, { errorName: error instanceof Error ? error.name : 'UnknownError' });
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Payment verification is temporarily unavailable.'));
  }
});

app.post("/api/paystack/webhook", (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const normalizedSignature = Array.isArray(signature) ? signature[0] : signature;
  const rawBody = req.rawBody || JSON.stringify(req.body);
  if (!verifyPaystackSignature(rawBody, normalizedSignature, process.env.PAYSTACK_SECRET_KEY)) {
    return sendApiError(res, req, new ApiError(401, 'UNAUTHORIZED', 'Invalid webhook signature.'));
  }

  res.status(200).json({ received: true });
  const event = req.body as { event?: string; data?: any };
  if (event.event !== 'charge.success' || !event.data) return;

  const metadata = parsePaystackMetadata(event.data.metadata);
  const uid = typeof metadata.uid === 'string' ? metadata.uid : '';
  const email = typeof event.data.customer?.email === 'string' ? event.data.customer.email : undefined;
  if (!uid || !isVerifiedPaystackTransaction(event.data, { uid, email, tier: 'pro' })) return;
  const period = metadata.period === 'year' ? 'year' : 'month';
  void grantProSubscription(event.data, uid, period).catch((error) => {
    logEvent('error', 'paystack_webhook_fulfillment_failed', req, { errorName: error instanceof Error ? error.name : 'UnknownError' });
  });
});

// Pro Mode: Generate Broader SEO & SWOT Competitor Analysis
app.post("/api/generate-analysis", requirePro(() => db), validateBody(generateAnalysisSchema), async (req, res) => {
  const { lead } = req.body;

  if (!lead) {
    return sendApiError(res, req, new ApiError(400, 'VALIDATION_ERROR', 'Lead object is required.'));
  }

  const mockCompetitors = [
    { 
      name: `${lead.name} Rivals Hub`, 
      website: `https://best-${lead.category.replace(/\s+/g, "").toLowerCase()}-${lead.city.toLowerCase()}.com`, 
      missedAdvantage: "Features premium customized appointment form and ranks first on Search Engine Local Pack." 
    },
    { 
      name: `Elite ${lead.category} Lounge`, 
      website: `https://elite-${lead.category.replace(/\s+/g, "").toLowerCase()}.com`, 
      missedAdvantage: "Operates digital reservation portal which increases weekly client conversion rate by 28%." 
    },
    { 
      name: `The Local ${lead.category} Co.`, 
      website: `https://thelocal${lead.category.replace(/\s+/g, "").toLowerCase()}${lead.city.toLowerCase()}.de`, 
      missedAdvantage: "Presents direct contact funnel synced with automated SMS reminder lines." 
    }
  ];

  if (!ai) {
    if (!runtimeConfig.allowDemoMode) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'AI service is temporarily unavailable.'));
    }
    // Generate static comprehensive fallback structure
    await new Promise(resolve => setTimeout(resolve, 800));
    return res.json({
      analysis: {
        swot: {
          strengths: [`Established physical space with high ratings in ${lead.city}`, "Commanding organic local community standing"],
          weaknesses: ["Total lack of brand website, causing high search friction", "No digitized table bookings or service catalog"],
          opportunities: ["Google Maps Local Pin visibility SEO optimization", "Deploying custom scheduling calendar landing page"],
          threats: ["Digital-ready local competitors taking high-value online inquiries"]
        },
        seoMetrics: {
          estimatedMonthlyMissedTraffic: "200 - 450 targeted local searches",
          estimatedBookingLossRevenue: "$1,200 - $3,000 / month",
          competitorCount: "approx. 7 nearby listings with active web booking",
          rankDifficulty: "Low-Medium (Page 1 ranking achievable in under 15 days)"
        },
        digitalStrategy: `Build an elegant, high-speed single-page site featuring local grid highlights, a streamlined reservation widget, and responsive mobile scheduling.`,
        competitors: mockCompetitors
      },
      source: "synthetic-demo-fallback",
      warning: "Synthetic demo data only; no live business details were verified."
    });
  }

  try {
    const prompt = `Perform a comprehensive B2B Local Marketing SWOT analysis and SEO Audit for:
Business Name: ${lead.name}
Category: ${lead.category}
City: ${lead.city}
Specific Context: ${lead.notes}

Provide highly realistic estimations for regional search traffic loss and specific SWOT items.
Only include competitors that are explicitly supported by the available evidence. If competitor identities or domains cannot be verified, return an empty competitors array and explain that limitation; never invent, fabricate, or label realistic examples as actual competitors.

Return strictly a valid raw JSON object. Do not include markdown wraps, ticks or text wrapping.
Strict Schema:
{
  "swot": {
    "strengths": ["...", "...", "..."],
    "weaknesses": ["...", "...", "..."],
    "opportunities": ["...", "...", "..."],
    "threats": ["...", "...", "..."]
  },
  "seoMetrics": {
    "estimatedMonthlyMissedTraffic": "...",
    "estimatedBookingLossRevenue": "...",
    "competitorCount": "...",
    "rankDifficulty": "..."
  },
  "digitalStrategy": "...",
  "competitors": [
    { "name": "...", "website": "https://...", "missedAdvantage": "..." },
    { "name": "...", "website": "https://...", "missedAdvantage": "..." },
    { "name": "...", "website": "https://...", "missedAdvantage": "..." }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text ? response.text.trim() : "{}";
    let analysis: any = {};
    try {
      analysis = JSON.parse(text);
    } catch (e) {
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      analysis = JSON.parse(cleanText);
    }

    if (!analysis.competitors) {
      analysis.competitors = mockCompetitors;
    }

    res.json({ analysis, source: "gemini" });
  } catch (error: any) {
    logEvent('warn', 'analysis_provider_failed', req, { errorName: error instanceof Error ? error.name : 'UnknownError' });
    if (!runtimeConfig.allowDemoMode) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Analysis service is temporarily unavailable.'));
    }
    res.json({
      analysis: {
        swot: {
          strengths: [`High local reputation index inside ${lead.city}`, "Exceptional word-of-mouth backing"],
          weaknesses: ["Zero online search discoverability without organic domain", "Relying purely on phone callbacks leading to schedule leaks"],
          opportunities: ["Localized maps indexing SEO rankings", "Custom mobile-first appointment booking form"],
          threats: ["Search keywords captured by modern-styled competitors"]
        },
        seoMetrics: {
          estimatedMonthlyMissedTraffic: "350+ missed digital opportunities",
          estimatedBookingLossRevenue: "$2,000+ monthly loss margin",
          competitorCount: "approx. 5 modern competitors in the neighborhood",
          rankDifficulty: "Low"
        },
        digitalStrategy: "Present a working visual site draft demonstrating scheduled notification triggers to easily overcome typical objection patterns.",
        competitors: mockCompetitors
      },
      source: "synthetic-demo-fallback",
      warning: "Synthetic demo analysis only; competitor and metric claims require independent verification."
    });
  }
});

// Pro Mode: Conversational AI Lead Assistant (Chatbot)
app.post("/api/chat-assistant", requirePro(() => db), validateBody(chatAssistantSchema), async (req, res) => {
  const { lead, messages } = req.body;

  if (!lead || !messages) {
    return sendApiError(res, req, new ApiError(400, 'VALIDATION_ERROR', 'Lead and messages parameters are required.'));
  }

  const systemInstruction = `You are "LeadCoach AI", a sharp, highly strategic B2B sales coach and local business marketing expert.
You are helping a web designer or salesperson pitch an online presence, responsive landing page, or appointment scheduler to '${lead.name}', a local '${lead.category}' provider in '${lead.city}'.

When answering:
- Address objection handling strategically (e.g., 'A website takes too much maintenance', 'I am already busy with offline work').
- Craft custom email sections, social scripts, or interactive text messages.
- Suggest realistic pricing models, tiered delivery options, and value-demonstration scripts.
- Speak directly, action-oriented, professional, and friendly. Avoid general or generic advice; always tailor suggestions to this brand's physical service niche and neighborhood context. Keep markdown formatting pristine.`;

  if (!ai) {
    if (!runtimeConfig.allowDemoMode) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'AI service is temporarily unavailable.'));
    }
    // Return friendly sandbox AI simulated response
    await new Promise(resolve => setTimeout(resolve, 800));
    const lastMsg = messages[messages.length - 1]?.content || "";
    const reply = `🤖 **[Sandbox Coach Active]** Understood! Pitching a **${lead.category}** like *${lead.name}* in *${lead.city}* requires handling specific fears. 

If they respond with *"I don't need a site, I'm already booked solid from word-of-mouth"*, instruct them with this script:

> "I love that! Word of mouth means you do great work. But how much time do you spend answering simple questions about pricing, location, or available booking times? Let's automate that with a simple 1-page landing system and free up 10 hours a week for your actual crafts."

What specific objection or pricing strategy would you like us to detail next?`;
    return res.json({ reply, source: "mock" });
  }

  try {
    const formattedHistory = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedHistory,
      config: {
        systemInstruction,
      }
    });

    res.json({ reply: response.text || "Assistant computed blank, please try again.", source: "gemini" });
  } catch (error: any) {
    logEvent('warn', 'assistant_provider_failed', req, { errorName: error instanceof Error ? error.name : 'UnknownError' });
    if (!runtimeConfig.allowDemoMode) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Assistant service is temporarily unavailable.'));
    }
    res.json({
      reply: `Sandbox assistant fallback: review this draft against the lead’s verified facts before use.`,
      source: "synthetic-demo-fallback",
      warning: "Synthetic demo response only; no factual business claims were verified."
    });
  }
});


// --- Gmail Cryptography & API Integrations ---
const encryptionService = createEncryptionService(
  runtimeConfig.encryptionKey || (runtimeConfig.isProduction ? undefined : 'development-only-leadsradar-key-32-bytes'),
);

app.post("/api/gmail/connect", requirePro(() => db), validateBody(gmailConnectSchema), async (req, res) => {
  const { email, token } = req.body;
  const uid = requirePrincipal(req).uid;
  try {
    const encryptedToken = encryptionService.encrypt(token);
    if (!db) {
      throw new Error("Firestore server is not configured.");
    }
    const userRef = db.collection("users").doc(uid);
    await userRef.set({ gmailConnected: true, gmailEmail: email }, { merge: true });
    await userRef.collection("integrations").doc("gmail").set({
      encryptedToken,
      email,
      updatedAt: new Date().toISOString(),
    });
    logEvent("info", "gmail_credentials_stored", req, { provider: "gmail" });
    res.json({ success: true });
  } catch (err: any) {
    logEvent("error", "gmail_connect_failed", req, { errorName: err instanceof Error ? err.name : 'UnknownError' });
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Gmail connection could not be secured.'));
  }
});

app.post("/api/gmail/disconnect", validateBody(gmailDisconnectSchema), async (req, res) => {
  const uid = requirePrincipal(req).uid;
  try {
    if (!db) throw new Error("Firestore server is not configured.");
    const userRef = db.collection("users").doc(uid);
    await userRef.collection("integrations").doc("gmail").delete();
    await userRef.set({ gmailConnected: false, gmailEmail: null }, { merge: true });
    logEvent("info", "gmail_credentials_deleted", req, { provider: "gmail" });
    return res.json({ success: true });
  } catch (error) {
    logEvent("error", "gmail_disconnect_failed", req, { errorName: error instanceof Error ? error.name : 'UnknownError' });
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Gmail credentials could not be disconnected.'));
  }
});

app.post("/api/gmail/send", requirePro(() => db), validateBody(gmailSendSchema), async (req, res) => {
  const { to, subject, body } = req.body;
  const uid = requirePrincipal(req).uid;
  try {
    if (!db) {
      throw new Error("Firestore server is not configured.");
    }
    const userSnap = await db.collection("users").doc(uid).get();
    const integrationSnap = await db.collection("users").doc(uid).collection("integrations").doc("gmail").get();
    if (!userSnap.exists || !integrationSnap.exists) {
      throw new Error("Gmail service is not connected for this user.");
    }
    const data = userSnap.data();
    const integration = integrationSnap.data();
    if (!data?.gmailConnected || !integration?.encryptedToken) {
      throw new Error("Gmail service is not connected for this user.");
    }

    const decryptedToken = encryptionService.decrypt(integration.encryptedToken);
    
    // Build RFC 822 email format
    const emailMsg = [
      `To: ${to}`,
      `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      body
    ].join('\r\n');
    
    const base64Raw = Buffer.from(emailMsg)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
       
    // Post to Google API users.me.messages.send
    const gmailResponse = await fetchWithTimeout("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${decryptedToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ raw: base64Raw })
    });
    
    if (!gmailResponse.ok) {
      await gmailResponse.text();
      logEvent('warn', 'gmail_provider_rejected_send', req, { providerStatus: gmailResponse.status });
      return sendApiError(res, req, new ApiError(gmailResponse.status === 401 ? 401 : 502, gmailResponse.status === 401 ? 'UNAUTHORIZED' : 'DEPENDENCY_UNAVAILABLE', 'Gmail provider rejected the send request.'));
    }

    const gmailResult = await gmailResponse.json() as any;
    logEvent('info', 'gmail_message_sent', req, { providerMessageId: typeof gmailResult.id === 'string' ? gmailResult.id : undefined });
    res.json({ success: true, messageId: gmailResult.id });
  } catch (err: any) {
    logEvent('error', 'gmail_send_failed', req, { errorName: err instanceof Error ? err.name : 'UnknownError' });
    return sendApiError(res, req, new ApiError(502, 'DEPENDENCY_UNAVAILABLE', 'Gmail send is temporarily unavailable.'));
  }
});

app.post("/api/gmail/check-replies", requirePro(() => db), validateBody(gmailReplyCheckSchema), async (req, res) => {
  const { leadEmail } = req.body;
  const uid = requirePrincipal(req).uid;
  try {
    if (!db) {
      throw new Error("Firestore server is not configured.");
    }
    const userSnap = await db.collection("users").doc(uid).get();
    const integrationSnap = await db.collection("users").doc(uid).collection("integrations").doc("gmail").get();
    if (!userSnap.exists) {
      throw new Error("User profile not found.");
    }
    const data = userSnap.data();
    const integration = integrationSnap.data();
    
    // Handle Outlook Sandbox fallback if Outlook connected
    if (data.outlookConnected && leadEmail.includes(".local")) {
      const simulatedReply = `Hi, thank you for reaching out! Your portfolio draft looks impressive. We are quite busy but could find 10 minutes next Tuesday at 2 PM for a quick phone call. Let me know if that works.`;
      
      const suggestionsPrompt = `The customer sent this reply email to us: "${simulatedReply}".
Craft a short, polite, professional follow-up suggestion confirming next Tuesday at 2 PM as a suggested answer for the web designer.
Write only the email body response, and keep it friendly and short.`;
      
      let suggestedAnswer = "Hi, that sounds perfect! I've booked our meeting for next Tuesday, May 30th at 2:00 PM. Looking forward to speaking with you then!";
      if (ai) {
        const aiRes = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: suggestionsPrompt,
        });
        suggestedAnswer = aiRes.text || suggestedAnswer;
      }
      
      return res.json({ 
        hasReply: true, 
        replySnippet: simulatedReply, 
        suggestedReply: suggestedAnswer 
      });
    }

    if (!data?.gmailConnected || !integrationSnap.exists || !integration?.encryptedToken) {
      return res.json({ hasReply: false });
    }

    const decryptedToken = encryptionService.decrypt(integration.encryptedToken);
    
    // Fetch threads or messages with search constraint from lead
    const listResponse = await fetchWithTimeout(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(`from:${leadEmail}`)}`, {
      headers: { "Authorization": `Bearer ${decryptedToken}` }
    });
    
    if (!listResponse.ok) {
      return res.json({ hasReply: false });
    }
    
    const listData = await listResponse.json() as any;
    if (!listData.messages || listData.messages.length === 0) {
      return res.json({ hasReply: false });
    }
    
    const msgId = listData.messages[0].id;
    const msgResponse = await fetchWithTimeout(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`, {
      headers: { "Authorization": `Bearer ${decryptedToken}` }
    });
    
    if (!msgResponse.ok) {
      return res.json({ hasReply: false });
    }
    
    const msgData = await msgResponse.json() as any;
    const replySnippet = msgData.snippet || "";
    
    const suggestionsPrompt = `You are an expert Sales Coach advising on B2B lead follow-up. The client sent this email in response:
Snippet: "${replySnippet}"

Craft a professional, friendly response that builds rapport and advances the sale. State the direct reply body. Limit it to 3-4 simple sentences.`;
    
    let suggestedReply = "Hi, thanks for getting back to me! I would love to connect for a 5-minute chat. Would this Friday at 11 AM work for you, or is there another date you prefer?";
    if (ai) {
      try {
        const aiResponse = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: suggestionsPrompt,
        });
        suggestedReply = aiResponse.text || suggestedReply;
      } catch (aiErr) {
        console.error("Gemini AI reply helper failure:", aiErr);
      }
    }
    
    res.json({ 
      hasReply: true, 
      replySnippet, 
      suggestedReply 
    });
  } catch (err: any) {
    logEvent('error', 'gmail_reply_check_failed', req, { errorName: err instanceof Error ? err.name : 'UnknownError' });
    return sendApiError(res, req, new ApiError(502, 'DEPENDENCY_UNAVAILABLE', 'Gmail reply checking is temporarily unavailable.'));
  }
});


app.use(errorHandler);

// Configure Vite middleware or production file serving
async function startServer() {
  if (!runtimeConfig.isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware configured.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static files server configured.");
  }

  app.listen(runtimeConfig.port, "0.0.0.0", () => {
    logEvent("info", "server_listening", undefined, { port: runtimeConfig.port, production: runtimeConfig.isProduction });
  });
}

startServer();
