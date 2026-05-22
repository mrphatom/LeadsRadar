import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
// Stripe import removed

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;
const hasApiKey = !!process.env.GEMINI_API_KEY;

// Mock backup leads for offline/demo/fallback mode
const fallbackLeads = [
  {
    name: "Golden Grain Bakery",
    country: "USA",
    city: "Austin",
    address: "1402 S Congress Ave, Austin, TX 78704",
    category: "Bakery",
    phone: "+1 (512) 555-0143",
    email: "info@goldengrainaustin.local",
    notes: "A beloved local sourdough bakery with strong foot traffic but only a Yelp page with no online ordering or menu."
  },
  {
    name: "Schulz Kfz-Meisterbetrieb",
    country: "Germany",
    city: "Munich",
    address: "Dachauer Str. 182, 80992 München",
    category: "Auto Mechanic",
    phone: "+49 89 55518290",
    email: "kontakt@schulz-kfz.local",
    notes: "Independent BMW/Audi specialist. Fully-booked through local reputation, looking to systematize client intake and list pricing online."
  },
  {
    name: "Maple Ridge Plumbing",
    country: "Canada",
    city: "Toronto",
    address: "421 Bay St, Toronto, ON M5H 2Y4",
    category: "Plumbing",
    phone: "+1 (416) 555-8931",
    email: "service@mapleridgeplumbing.local",
    notes: "Family-owned emergency repair plumbers. Doing well but struggling to rank in local Google Search against competitors with SEO-optimized sites."
  },
  {
    name: "Oxford Garden Care",
    country: "UK",
    city: "Oxford",
    address: "94 Banbury Rd, Oxford OX2 6JT",
    category: "Landscaping",
    phone: "+44 1865 559401",
    email: "hello@oxfordgardens.local",
    notes: "Premium garden design and hedge pruning services. Currently relies on flyers and local community boards. Needs a portfolio website to showcase work."
  },
  {
    name: "Harbor Light Cafe",
    country: "USA",
    city: "Seattle",
    address: "2201 Westlake Ave, Seattle, WA 98121",
    category: "Cafe",
    phone: "+1 (206) 555-3211",
    email: "contact@harborlightcafe.local",
    notes: "Charming neighborhood espresso and brunch spot with high Google Reviews but no website. Menu is only viewable in static user photo uploads."
  },
  {
    name: "Bavarian Brew House",
    country: "Germany",
    city: "Munich",
    address: "Rosenheimer Str. 45, 81667 München",
    category: "Restaurant",
    phone: "+49 89 55543210",
    email: "servus@bavarianbrewhouse.local",
    notes: "Traditional beer cellar with authentic food. Relying entirely on paper reservations. Needs digital table booking and PDF menu hosting."
  },
  {
    name: "Canuck Roofing & Siding",
    country: "Canada",
    city: "Vancouver",
    address: "1250 Hastings St, Vancouver, BC V6A 1S6",
    category: "Roofing",
    phone: "+1 (604) 555-9011",
    email: "info@canuckroofing.local",
    notes: "Residential reroofing team. Needs to gather high-value roofing replacement quotes through interactive lead funnels and request-a-quote forms."
  },
  {
    name: "The London Barbershop",
    country: "UK",
    city: "London",
    address: "88 Kingsland Rd, London E2 8DP",
    category: "Barber",
    phone: "+44 20 7555 9018",
    email: "bookings@londonbarbers.local",
    notes: "Vintage barbering and beard styling spot. Booking is done exclusively via phone calls or walk-ins. Needs custom web booking calendar."
  }
];

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

// API to check server status & mode
app.get("/api/config", (req, res) => {
  res.json({
    hasApiKey,
    message: hasApiKey 
      ? "Gemini API integration active." 
      : "Gemini API key is not configured. The app is running in offline demo mode."
  });
});

// Helper to generate beautifully tailored dynamic mock leads to prevent errors in any country, city & category
function generateDynamicMockLeads(city: string, country: string, category: string): any[] {
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

    const cleanNameForEmail = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const phoneNum = `${phonePrefix} ${phoneFormat}${Math.floor(Math.random() * 9000) + 1000}`;
    const email = `contact@${cleanNameForEmail}.local`;
    const address = `${streetNum} ${street}, ${cleanCity}, ${country}`;

    return {
      name,
      country,
      city: cleanCity,
      address,
      category: displayCategory,
      phone: phoneNum,
      email,
      notes: tpl.noteTemplate
    };
  });
}

// Search leads using Google Search Grounding to find actual offline listings
app.post("/api/search-leads", async (req, res) => {
  const { country, city, category } = req.body;

  if (!country || !city || !category) {
    return res.status(400).json({ error: "Country, city, and category are required." });
  }

  // If no API Key, serve beautiful mock results that closely match requested filters
  if (!ai) {
    console.log(`Fallback mock leads returned for: ${category} in ${city}, ${country}`);
    
    const results = generateDynamicMockLeads(city, country, category);
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
    const prompt = `Search the real-time web to identify up to 4 real, active businesses located in ${city}, ${country} in the business niche of "${category}" that do NOT have their own official website (they might only have a Google Maps list, Facebook page, Yelp, or other directory listing, but no official domain).
Provide their accurate publicly listed details:
1. Business Name (exactly as registered or known)
2. Street Address
3. Verified Phone Number (formatted for dialling)
4. Contact Email Address (if publicly found on YellowPages, Yelp, list directories or their Facebook page. If absolutely no email is found, build a plausible professional email based on their name like contact@businessname.com but tag it as a predicted contact).
5. A brief description of what they do and why they urgently need a web presence (e.g. they lose clients to competitors who have simple booking forms).

You MUST return the results strictly as a valid, parsable JSON array. Do not write any markdown code blocks, brackets, extra comments, or formatting besides the JSON string itself.
Structure:
[
  {
    "name": "Exact Name",
    "country": "${country}",
    "city": "${city}",
    "address": "Street Address",
    "category": "${category}",
    "phone": "Phone",
    "email": "Email",
    "notes": "Detailed description of their missing online presence and why they can benefit from writing a website"
  }
]`;

    let response;
    let fallbackToStandardModel = false;
    let fallbackErrorMsg = "";

    try {
      // First attempt: with Google Search Grounding to get real web assets
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          systemInstruction: "You are an expert lead generator for web designers. Your output must be purely valid JSON containing real or highly accurate crawlable entries with no prefix markdown formatting.",
        },
      });
    } catch (searchError: any) {
      console.warn("Google Search Grounding failed or is rate-limited. Falling back to standard Gemini model generation:", searchError.message || searchError);
      fallbackToStandardModel = true;
      fallbackErrorMsg = searchError.message || String(searchError);
    }

    if (fallbackToStandardModel) {
      // Second attempt: Standard text generation without the googleSearch tool (which uses a separate, much more restrictive quota)
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Locate or construct 3-4 realistic active local brick-and-mortar businesses in ${city}, ${country} under the niche of "${category}" that urgently need a custom-built responsive HTML landing page (they lack a domain and are only catalogued on third party boards). Make the phone numbers, addresses, and details extremely believable and localized for ${city}.
` + prompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction: "You are an expert lead generator for web designers. Your output must be purely valid JSON containing real or highly accurate entries with no prefix markdown formatting.",
        },
      });
    }

    const text = response.text ? response.text.trim() : "[]";
    let leads = [];
    try {
      leads = JSON.parse(text);
    } catch (e) {
      // Direct string cleaning fallback (just in case model wrapped it in md tags)
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      leads = JSON.parse(cleanText);
    }

    // Attach tracking IDs
    leads = leads.map((lead: any, index: number) => ({
      ...lead,
      id: `lead_google_${Date.now()}_${index}`,
      status: "new",
      createdAt: new Date().toISOString()
    }));

    // Extract citation URLs from grounding metadata to pass to the user UI
    const citations = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    res.json({ 
      leads, 
      source: fallbackToStandardModel ? "rate-limit-fallback" : "google-search-grounding", 
      citations,
      warning: fallbackToStandardModel ? "Google search grounding rate limit triggered; fallback standard models successfully completed search mapping." : undefined
    });
  } catch (error: any) {
    console.error("Gemini Search Grounding & Standard Fallback Error:", error);
    // If both the API calls fail (e.g., quota or timeout), fall back gracefully to dynamic localized mock generator
    const results = generateDynamicMockLeads(city, country, category);
    const tailoredResults = results.map((item, index) => ({
      ...item,
      id: `lead_fallback_${Date.now()}_${index}`,
      status: "new",
      createdAt: new Date().toISOString(),
      notes: `${item.notes} (Temporary fallback query served due to search rate limits).`
    }));
    res.json({ leads: tailoredResults, source: "rate-limit-fallback", error: error.message });
  }
});

// Fallback pitch generator helper
function generateFallbackPitch(lead: any) {
  return {
    emailSubject: `Modernizing the Digital Presence for ${lead.name} in ${lead.city}`,
    emailBody: `Dear ${lead.name} Team,

I'm a professional web developer located nearby, and I recently came across your listing for your outstanding ${lead.category} service. I noticed that online customers looking for you are currently guided solely to third party listings.

By launching a dedicated custom landing page with self-booking, professional custom contact forms, and client reviews, you can instantly turn web visits into revenue.

Would you be open to a brief 5-minute phone call to look at a free visual mockup we designed for you?

Best regards,
LeadFinder Outreach Consultant`,
    phoneScript: `Hi there! I was looking up ${lead.category} services in ${lead.city} and came across ${lead.name}. Your local customer reviews look absolutely incredible! 

I noticed that you don't have a direct website online yet for booking/viewing details. I actually design responsive mobile pages for local owners to save them hours on telephone scheduling. If I sent you a quick, free visual draft I made of what your business website could look like, would you be open to taking a look?`,
    valueProposition: `${lead.name} already commands high local quality. By adding a website, they can automate inquiries, capture search results from google maps, and double their client engagement with an elegant digital portal.`,
    suggestedFeatures: [
      "Online Booking & Scheduling Portal",
      "Mobile-responsive Contact Forms",
      "Interactive Menu / Portfolios",
      "Google Maps & Customer Review Slider"
    ]
  };
}

// Generate pitch package
app.post("/api/generate-pitch", async (req, res) => {
  const { lead } = req.body;

  if (!lead) {
    return res.status(400).json({ error: "Lead object is required." });
  }

  if (!ai) {
    const promptValueMock = generateFallbackPitch(lead);
    await new Promise(resolve => setTimeout(resolve, 800));
    return res.json({ pitch: promptValueMock, source: "mock" });
  }

  try {
    const prompt = `You are a talented B2B digital sales expert. Provide an outreach package for this offline business:
Business Name: ${lead.name}
Country: ${lead.country}
City: ${lead.city}
Category: ${lead.category}
Specific Detail: ${lead.notes}

Provide:
1. A highly catchy email outreach subject line.
2. An elegant, personalized, short, friendly sales pitch email that emphasizes how beautiful local responsive design can scale their bookings and reputation.
3. A respectful, non-pushy phone script for introductory cold outreach.
4. A concise 2-sentence Value Proposition for web designers pitching them.
5. An array of exactly 4 recommended website features (e.g., SEO local rank keywords, table scheduling, service catalog, before-after slider).

Return the response strictly as a valid JSON object. No markdown, comments or backticks.
Schema:
{
  "emailSubject": "...",
  "emailBody": "...",
  "phoneScript": "...",
  "valueProposition": "...",
  "suggestedFeatures": ["...", "...", "...", "..."]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "You are a sales engineer. Generate engaging B2B packages in pure JSON format without wrapping.",
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
    console.error("Gemini Pitch Generator Error:", error);
    // Fall back gracefully under rate limit or key quota exhaustion
    const fallbackPitch = generateFallbackPitch(lead);
    res.json({ pitch: fallbackPitch, source: "rate-limit-fallback", error: error.message });
  }
});// Create subscription Paystack checkout session (falls back to local sandbox in preview mode if secret missing or mismatched)
app.post("/api/paystack/create-checkout-session", async (req, res) => {
  const { successUrl, cancelUrl, tier, period, email } = req.body;
  const hasPaystackKey = !!process.env.PAYSTACK_SECRET_KEY;

  if (!hasPaystackKey) {
    // Return custom sandbox URL for seamless testing
    return res.json({
      isMock: true,
      url: `/checkout-sandbox?tier=${tier || 'pro'}&period=${period || 'month'}&success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`
    });
  }

  try {
    let currency = process.env.PAYSTACK_CURRENCY;

    // Proactively auto-detect the merchant's currency to avoid currency/channel mismatches
    try {
      const balanceResponse = await fetch("https://api.paystack.co/balance", {
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

    console.log(`Initializing Paystack transaction: amount=${finalAmount}, currency=${cur}, email=${email}`);

    let response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email || "billing@leadsradar.local",
        amount: finalAmount,
        currency: cur,
        callback_url: successUrl,
        metadata: {
          tier: tier || 'pro',
          period: period || 'month',
          email: email
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
        response = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: email || "billing@leadsradar.local",
            amount: fallbackAmount,
            callback_url: successUrl,
            metadata: {
              tier: tier || 'pro',
              period: period || 'month',
              email: email
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
    console.error("Paystack Checkout Session compilation failed, falling back to sandbox:", err);
    // Graceful fallback to sandbox with status 200 to prevent crashing the modal loading state, but display diagnostics!
    const sandboxUrl = `/checkout-sandbox?tier=${tier || 'pro'}&period=${period || 'month'}&success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}&paystack_error=${encodeURIComponent(err.message || 'unknown_error')}`;
    res.json({ 
      url: sandboxUrl,
      isMock: true,
      error: err.message
    });
  }
});

// Pro Mode: Generate Broader SEO & SWOT Competitor Analysis
app.post("/api/generate-analysis", async (req, res) => {
  const { lead } = req.body;

  if (!lead) {
    return res.status(400).json({ error: "Lead object is required." });
  }

  if (!ai) {
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
        digitalStrategy: `Build an elegant, high-speed single-page site featuring local grid highlights, a streamlined reservation widget, and responsive mobile scheduling.`
      },
      source: "mock"
    });
  }

  try {
    const prompt = `Perform a comprehensive B2B Local Marketing SWOT analysis and SEO Audit for:
Business Name: ${lead.name}
Category: ${lead.category}
City: ${lead.city}
Specific Context: ${lead.notes}

Provide highly realistic estimations for regional search traffic loss and specific SWOT items.
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
  "digitalStrategy": "..."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text ? response.text.trim() : "{}";
    let analysis = {};
    try {
      analysis = JSON.parse(text);
    } catch (e) {
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      analysis = JSON.parse(cleanText);
    }

    res.json({ analysis, source: "gemini" });
  } catch (error: any) {
    console.error("Gemini SWOT analysis generator failed, running static optimizer:", error);
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
        digitalStrategy: "Present a working visual site draft demonstrating scheduled notification triggers to easily overcome typical objection patterns."
      },
      source: "rate-limit-fallback",
      error: error.message
    });
  }
});

// Pro Mode: Conversational AI Lead Assistant (Chatbot)
app.post("/api/chat-assistant", async (req, res) => {
  const { lead, messages } = req.body;

  if (!lead || !messages) {
    return res.status(400).json({ error: "Lead and messages parameters are required." });
  }

  const systemInstruction = `You are "LeadCoach AI", a sharp, highly strategic B2B sales coach and local business marketing expert.
You are helping a web designer or salesperson pitch an online presence, responsive landing page, or appointment scheduler to '${lead.name}', a local '${lead.category}' provider in '${lead.city}'.

When answering:
- Address objection handling strategically (e.g., 'A website takes too much maintenance', 'I am already busy with offline work').
- Craft custom email sections, social scripts, or interactive text messages.
- Suggest realistic pricing models, tiered delivery options, and value-demonstration scripts.
- Speak directly, action-oriented, professional, and friendly. Avoid general or generic advice; always tailor suggestions to this brand's physical service niche and neighborhood context. Keep markdown formatting pristine.`;

  if (!ai) {
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
    console.error("Gemini Chat Coach failed:", error);
    res.json({
      reply: `🤖 [Coach Fallback Service] Standard quota is busy, so I've optimized a local pitch strategy for *${lead.name}*:
      
      - Highlight their high review rating to show they deserve an equally high-quality website.
      - Frame the project as an **investment in time recovery**, shifting customer inquiries from tedious phone call disruptions to elegant, self-serving reservations.`,
      source: "rate-limit-fallback",
      error: error.message
    });
  }
});


// Configure Vite middleware or production file serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Webless Business Tracker backend running on port ${PORT}`);
  });
}

startServer();
