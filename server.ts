import express from "express";
import path from "path";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import fs from "fs";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { initializeApp as initAdminApp, getApps, getApp, cert } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getRuntimeConfig } from "./src/server/runtimeConfig.ts";
import { errorHandler, logEvent, requestContext, requireAuth, requirePrincipal, requirePro, sendApiError, validateBody } from "./src/server/http.ts";
import { ApiError, isAllowedOrigin } from "./src/server/security.ts";
import { createEncryptionService } from "./src/server/crypto.ts";
import { buildMoonPayWidgetUrl, extractMoonPayOrderId, signMoonPayUrl, verifyMoonPayWebhookSignature } from "./src/server/moonpay.ts";
import { fulfillMoonPaySubscription } from "./src/server/moonpayFulfillment.ts";
import { consumeDailySearchQuota, releaseDailySearchQuota } from "./src/server/quotas.ts";
import { sanitizeLeadContact } from "./src/utils/leadSanitizer.ts";
import { getGooglePlaceDetails, isExactPlaceNameMatch, isOperationalOrUnspecified, mapGooglePlaceToLead, searchGooglePlaces } from "./src/server/googlePlaces.ts";
import {
  chatAssistantSchema,
  moonpaySignUrlSchema,
  moonpayWebhookEventSchema,
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
app.use(runtimeConfig.isProduction
  ? helmet()
  : helmet({ contentSecurityPolicy: false }));
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
          console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT; server-side Firebase initialization is unavailable.", parseErr instanceof Error ? parseErr.name : "UnknownError");
          throw new Error("FIREBASE_SERVICE_ACCOUNT must contain valid JSON.");
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
    if (runtimeConfig.isProduction) {
      throw new Error("firebase-applet-config.json is required for production server initialization.");
    }
  }
} catch (err) {
  console.error("Failed to initialize server-side Firebase Admin services.", err instanceof Error ? err.name : "UnknownError");
  if (runtimeConfig.isProduction) {
    throw err;
  }
}

app.get("/healthz", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ status: "ok" });
});

app.get("/readyz", (_req, res) => {
  const ready = Boolean(db && adminAuth);
  res.setHeader("Cache-Control", "no-store");
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready" });
});

const hasGeminiApiKey = Boolean(process.env.GEMINI_API_KEY);
const hasGooglePlacesApiKey = Boolean(runtimeConfig.googlePlacesApiKey);
const GEMINI_MODEL = runtimeConfig.geminiModel;

// Verify or initialize Gemini for clearly labeled generated guidance only.
let ai: GoogleGenAI | null = null;
if (hasGeminiApiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    console.log("Successfully initialized Gemini Client.");
  } catch (error) {
    console.error("Failed to initialize Gemini Client: ", error instanceof Error ? error.name : "UnknownError");
  }
} else {
  console.log("No GEMINI_API_KEY loaded. Generated guidance routes are unavailable; no synthetic fallback is used.");
}

const authenticate = requireAuth(async (token) => {
  if (!adminAuth) {
    throw new Error("Firebase Admin Auth is unavailable.");
  }
  return adminAuth.verifyIdToken(token, true);
});

app.use("/api", (req, res, next) => {
  if (req.path === "/config" || req.path === "/webhooks/moonpay") {
    next();
    return;
  }
  authenticate(req, res, next);
});

// API availability is explicit: discovery is provider-backed; AI routes are generated guidance only.
app.get("/api/config", (_req, res) => {
  res.json({
    discoveryProvider: 'google-places-api',
    discoveryAvailable: hasGooglePlacesApiKey,
    guidanceAvailable: Boolean(ai),
    billingAvailable: runtimeConfig.billingAvailable,
    message: hasGooglePlacesApiKey
      ? 'Google Places discovery is configured. Records are returned only from the provider.'
      : 'Google Places discovery is not configured. No synthetic lead fallback is available.',
  });
});


// Shared sanitizer preserves missing-data markers and provenance instead of fabricating contacts.
function sanitizeServerLead(lead: any): any {
  return sanitizeLeadContact(lead);
}

// Search structured Google Places records; no generative lead identity or contact fallback is permitted
app.post("/api/search-leads", validateBody(searchLeadsSchema), async (req, res) => {
  const { country, city, category } = req.body;
  const apiKey = runtimeConfig.googlePlacesApiKey;
  if (!apiKey) {
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Google Places discovery is not configured.'));
  }

  let reservedQuotaDay: string | undefined;
  let principalUid: string | undefined;
  try {
    const principal = requirePrincipal(req);
    principalUid = principal.uid;
    if (!db) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Usage quota service is temporarily unavailable.'));
    }
    const quota = await consumeDailySearchQuota(db, principal.uid);
    if (!quota.allowed) {
      res.setHeader('Retry-After', '86400');
      return sendApiError(res, req, new ApiError(429, 'RATE_LIMITED', 'Daily search limit reached for the ' + quota.tier + ' plan.'));
    }
        reservedQuotaDay = quota.allowed ? quota.day : undefined;
    res.setHeader('X-Search-Quota-Remaining', String(quota.remaining));
    const retrievedAt = new Date().toISOString();
    const places = await searchGooglePlaces(apiKey, category + ' in ' + city + ', ' + country, 10);
    const leads = places
      .filter(isOperationalOrUnspecified)
      .filter((place) => !place.websiteUri)
      .map((place) => mapGooglePlaceToLead(place, country, city, category, retrievedAt))
      .map((lead) => sanitizeServerLead(lead));
    const citations = leads.flatMap((lead) => (lead.sourceUrls || []).map((uri) => ({ title: lead.name, uri })));

    return res.json({
      leads,
      source: 'google-places-api',
      provider: 'Google Places API (New)',
      retrievedAt,
      citations,
      quota: { tier: quota.tier, used: quota.used, limit: quota.limit, remaining: quota.remaining, day: quota.day },
      warning: 'Records are sourced from Google Places at retrieval time. Email, LinkedIn, and social profiles are not returned by this provider and are not inferred.',
    });
  } catch (error) {
    if (db && principalUid && reservedQuotaDay) {
      try {
        await releaseDailySearchQuota(db, principalUid, reservedQuotaDay);
      } catch (releaseError) {
        logEvent('error', 'google_places_quota_release_failed', req, { errorName: releaseError instanceof Error ? releaseError.name : 'UnknownError' });
      }
    }
    logEvent('warn', 'google_places_discovery_failed', req, { errorName: error instanceof Error ? error.name : 'UnknownError' });
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Google Places discovery is temporarily unavailable.'));
  }
});

// Refresh one structured Google Places record by Place ID or an unambiguous name match
app.post("/api/enrich-lead", validateBody(enrichLeadSchema), async (req, res) => {
  const { name, city, country, category, placeId } = req.body;
  const apiKey = runtimeConfig.googlePlacesApiKey;
  if (!apiKey) {
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Google Places enrichment is not configured.'));
  }

  try {
    let place;
    if (placeId) {
      place = await getGooglePlaceDetails(apiKey, placeId);
    } else {
      const candidates = (await searchGooglePlaces(apiKey, name + ', ' + city + ', ' + country, 5)).filter(isOperationalOrUnspecified);
      const exactMatches = candidates.filter((candidate) => isExactPlaceNameMatch(candidate, name));
      if (exactMatches.length !== 1) {
        return sendApiError(res, req, new ApiError(404, 'NOT_FOUND', 'Google Places returned no unambiguous matching business record.'));
      }
      place = exactMatches[0];
    }

    const retrievedAt = new Date().toISOString();
    const enriched = sanitizeServerLead(mapGooglePlaceToLead(place, country, city, category || '', retrievedAt));
    const citations = (enriched.sourceUrls || []).map((uri) => ({ title: enriched.name, uri }));
    return res.json({
      enriched,
      source: 'google-places-api',
      provider: 'Google Places API (New)',
      retrievedAt,
      citations,
      warning: 'Only fields returned by Google Places are included. Email, LinkedIn, and social profiles are not inferred.',
    });
  } catch (error) {
    logEvent('warn', 'google_places_enrichment_failed', req, { errorName: error instanceof Error ? error.name : 'UnknownError' });
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Google Places enrichment is temporarily unavailable.'));
  }
});

// --- LinkedIn Company & Employee Intelligence Endpoint ---
app.post("/api/linkedin-intelligence", requirePro(() => db), validateBody(linkedinIntelligenceSchema), async (req, res) => {
  logEvent('info', 'linkedin_intelligence_unavailable', req, { provider: 'not-configured' });
  return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'LinkedIn intelligence is not configured. No unverified company or decision-maker data is returned.'));
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


// Generate pitch package
app.post("/api/generate-pitch", requirePro(() => db), validateBody(generatePitchSchema), async (req, res) => {
  const { lead, variant = "direct", language = "English" } = req.body;

  if (!lead) {
    return sendApiError(res, req, new ApiError(400, 'VALIDATION_ERROR', 'Lead object is required.'));
  }

  if (!ai) {
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Pitch generation is temporarily unavailable.'));
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
      model: GEMINI_MODEL,
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
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Pitch generation is temporarily unavailable.'));
  }
});

// MoonPay Fiat On-Ramp signing and fulfillment
const MOONPAY_BASE_CURRENCY_CODE = runtimeConfig.moonpayBaseCurrencyCode;
const MOONPAY_CURRENCY_CODE = runtimeConfig.moonpayCurrencyCode;
const MOONPAY_MONTHLY_AMOUNT = runtimeConfig.moonpayMonthlyAmount;
const MOONPAY_YEARLY_AMOUNT = runtimeConfig.moonpayYearlyAmount;


app.get('/api/moonpay/sign-url', async (req, res) => {
  const principal = requirePrincipal(req);
  const parsed = moonpaySignUrlSchema.safeParse(req.query);
  if (!parsed.success) {
    return sendApiError(res, req, new ApiError(422, 'VALIDATION_ERROR', 'MoonPay checkout parameters are invalid.'));
  }
  if (!db || !runtimeConfig.billingAvailable) {
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'MoonPay payment service is not configured.'));
  }

  const period = parsed.data.period;
  const orderId = 'moonpay_' + randomUUID();
  const amount = period === 'year' ? MOONPAY_YEARLY_AMOUNT : MOONPAY_MONTHLY_AMOUNT;
  const environment = runtimeConfig.moonpayEnvironment;
  const widgetUrl = buildMoonPayWidgetUrl({
    environment,
    publishableKey: process.env.MOONPAY_PUBLISHABLE_KEY,
    baseCurrencyCode: MOONPAY_BASE_CURRENCY_CODE,
    baseCurrencyAmount: amount,
    currencyCode: MOONPAY_CURRENCY_CODE,
    walletAddress: process.env.TREASURY_WALLET_ADDRESS,
    externalTransactionId: orderId,
    redirectUrl: new URL('/', runtimeConfig.appUrl).toString(),
  });

  try {
    await db.collection('moonpayOrders').doc(orderId).set({
      uid: principal.uid,
      period,
      provider: 'moonpay',
      status: 'pending',
      externalTransactionId: orderId,
      amount,
      baseCurrencyCode: MOONPAY_BASE_CURRENCY_CODE,
      currencyCode: MOONPAY_CURRENCY_CODE,
      walletAddress: process.env.TREASURY_WALLET_ADDRESS,
      environment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const signedUrl = signMoonPayUrl(widgetUrl, process.env.MOONPAY_SECRET_KEY);
    logEvent('info', 'moonpay_checkout_initialized', req, { provider: 'moonpay', period, environment });
    return res.json({ provider: 'moonpay', orderId, externalTransactionId: orderId, url: signedUrl.toString(), environment });
  } catch (error) {
    logEvent('error', 'moonpay_checkout_initialization_failed', req, { errorName: error instanceof Error ? error.name : 'UnknownError' });
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'MoonPay checkout could not be initialized.'));
  }
});

app.post('/api/webhooks/moonpay', async (req, res) => {
  if (!db || !runtimeConfig.billingAvailable) {
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'MoonPay payment service is not configured.'));
  }

  const signatureHeader = req.headers['moonpay-signature-v2'] ?? req.headers['moonpay-signature'];
  const normalizedSignature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  const rawBody = req.rawBody;
  if (!rawBody || !verifyMoonPayWebhookSignature(rawBody, normalizedSignature, process.env.MOONPAY_WEBHOOK_SECRET)) {
    return sendApiError(res, req, new ApiError(401, 'UNAUTHORIZED', 'Invalid MoonPay webhook signature.'));
  }

  const parsed = moonpayWebhookEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendApiError(res, req, new ApiError(422, 'VALIDATION_ERROR', 'MoonPay webhook payload is invalid.'));
  }
  if (parsed.data.type !== 'transaction_updated') {
    return res.status(200).json({ received: true, fulfilled: false });
  }

  const transaction = parsed.data.data;
  if (transaction.status !== 'completed') {
    return res.status(200).json({ received: true, fulfilled: false });
  }
  const externalTransactionId = extractMoonPayOrderId(transaction);
  if (!externalTransactionId) {
    logEvent('warn', 'moonpay_webhook_missing_order_id', req, { provider: 'moonpay' });
    return res.status(200).json({ received: true, fulfilled: false });
  }

  try {
    const result = await fulfillMoonPaySubscription(
      db,
      externalTransactionId,
      transaction,
      process.env.TREASURY_WALLET_ADDRESS || '',
    );
    logEvent('info', 'moonpay_webhook_processed', req, { provider: 'moonpay', result });
    return res.status(200).json({ received: true, fulfilled: result !== 'ignored', result });
  } catch (error) {
    logEvent('error', 'moonpay_webhook_fulfillment_failed', req, { errorName: error instanceof Error ? error.name : 'UnknownError' });
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'MoonPay fulfillment is temporarily unavailable.'));
  }
});

// Pro Mode: Generate clearly labeled strategy hypotheses from supplied lead fields
app.post("/api/generate-analysis", requirePro(() => db), validateBody(generateAnalysisSchema), async (req, res) => {
  const { lead } = req.body;

  if (!lead) {
    return sendApiError(res, req, new ApiError(400, 'VALIDATION_ERROR', 'Lead object is required.'));
  }



  if (!ai) {
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Analysis service is temporarily unavailable.'));
  }

  try {
        const prompt = `Generate strategy hypotheses and validation questions for the supplied lead fields.
Business Name: ${lead.name}
Category: ${lead.category}
City: ${lead.city}
Specific Context: ${lead.notes}
Use only the explicit fields supplied in the lead object as inputs. Do not infer or assert facts about the business, its customers, rankings, revenue, traffic, reviews, competitors, website, or online presence. Do not create competitor identities or URLs. All measurement fields must be the literal string "Not measured" and competitors must be an empty array.
Return strictly a valid raw JSON object. Do not include markdown wraps, ticks or text wrapping.
Strict Schema:
{
  "swot": {
    "strengths": ["hypothesis"],
    "weaknesses": ["validation question"],
    "opportunities": ["hypothesis"],
    "threats": ["risk to validate"]
  },
  "seoMetrics": {
    "estimatedMonthlyMissedTraffic": "Not measured",
    "estimatedBookingLossRevenue": "Not measured",
    "competitorCount": "Not measured",
    "rankDifficulty": "Not measured"
  },
  "digitalStrategy": "guidance only",
  "competitors": []
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
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

    const safeAnalysis = {
      ...analysis,
      seoMetrics: {
        estimatedMonthlyMissedTraffic: 'Not measured',
        estimatedBookingLossRevenue: 'Not measured',
        competitorCount: 'Not measured',
        rankDifficulty: 'Not measured',
      },
      competitors: [],
      dataQuality: 'generated-guidance',
      evidenceBacked: false,
    };

    res.json({
      analysis: safeAnalysis,
      source: "gemini-generated-guidance",
      warning: "Generated strategy only. Traffic, revenue, ranking, review, and competitor facts were not independently measured or verified.",
    });
  } catch (error: any) {
    logEvent('warn', 'analysis_provider_failed', req, { errorName: error instanceof Error ? error.name : 'UnknownError' });
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Analysis service is temporarily unavailable.'));
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
- Use only facts explicitly present in the supplied lead object or conversation.
- Treat every business fact as unverified unless it includes source evidence in the lead data.
- Offer hypotheses, questions, and recommendations, not claims about ratings, revenue, traffic, rankings, customers, or competitor activity.
- Never invent contact details, reviews, business history, performance metrics, or completed audits.
- Craft custom email sections, social scripts, or interactive text messages without implying that an audit or contact has already occurred.
- Speak directly, action-oriented, professional, and friendly. Keep markdown formatting pristine.`;

  if (!ai) {
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Assistant service is temporarily unavailable.'));
  }

  try {
    const formattedHistory = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }]
    }));

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: formattedHistory,
      config: {
        systemInstruction,
      }
    });

    if (!response.text?.trim()) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Assistant service returned no guidance.'));
    }
    res.json({ reply: response.text.trim(), source: "gemini-generated-guidance", evidenceBacked: false });
  } catch (error: any) {
    logEvent('warn', 'assistant_provider_failed', req, { errorName: error instanceof Error ? error.name : 'UnknownError' });
    return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Assistant service is temporarily unavailable.'));
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
    
    if (!ai) {
      return res.json({ hasReply: true, replySnippet, suggestedReply: null, guidanceAvailable: false });
    }

    const suggestionsPrompt = `You are an expert Sales Coach advising on B2B lead follow-up. The client sent this email in response:
Snippet: "${replySnippet}"

Craft a professional, friendly response that builds rapport and advances the sale. Do not invent facts, commitments, dates, prices, or actions. Limit it to 3-4 simple sentences.`;
    let suggestedReply: string | null = null;
    try {
      const aiResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: suggestionsPrompt,
      });
      suggestedReply = aiResponse.text || null;
    } catch (aiErr) {
      logEvent('warn', 'gmail_reply_guidance_unavailable', req, { errorName: aiErr instanceof Error ? aiErr.name : 'UnknownError' });
    }

    res.json({
      hasReply: true,
      replySnippet,
      suggestedReply,
      guidanceAvailable: Boolean(suggestedReply),
    });
  } catch (err: any) {
    logEvent('error', 'gmail_reply_check_failed', req, { errorName: err instanceof Error ? err.name : 'UnknownError' });
    return sendApiError(res, req, new ApiError(502, 'DEPENDENCY_UNAVAILABLE', 'Gmail reply checking is temporarily unavailable.'));
  }
});


// Configure Vite middleware or production file serving
async function startServer() {
  if (!runtimeConfig.isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.method !== 'GET' || !req.accepts('html') || req.path.startsWith('/api/')) {
        next();
        return;
      }

      try {
        const templatePath = path.resolve(process.cwd(), 'index.html');
        const transformedTemplate = await vite.transformIndexHtml(
          req.originalUrl,
          fs.readFileSync(templatePath, 'utf8'),
        );
        const template = process.env.DISABLE_HMR === 'true'
          ? transformedTemplate.replace(/\s*<script type="module" src="\/@vite\/client"><\/script>/, '')
          : transformedTemplate;
        res.status(200).type('html').send(template);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
    console.log("Vite development middleware configured.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        const fileName = path.basename(filePath);
        const isFingerprintAsset = /\.[a-f0-9]{8,}\./i.test(fileName);
        res.setHeader("Cache-Control", isFingerprintAsset
          ? "public, max-age=31536000, immutable"
          : "no-cache");
      },
    }));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static files server configured.");
  }
  app.use(errorHandler);
  app.listen(runtimeConfig.port, "0.0.0.0", () => {
    logEvent("info", "server_listening", undefined, { port: runtimeConfig.port, production: runtimeConfig.isProduction });
  });
}

startServer();
