# LeadsRadar — Webless Business Tracker & Outreach Workspace

LeadsRadar (Webless Business Tracker) is an elite, responsive full-stack B2B outreach workspace built using React, Vite, Tailwind CSS, Express, and Google Cloud Firestore. It is designed specifically to help sales departments, independent agencies, and business development officers discover high-potential offline businesses in the **USA, United Kingdom, Germany, and Canada** that do not currently have an active website.

By scanning and identifying these businesses, LeadsRadar crafts hyper-targeted sales scripts, generates intelligent competitive SWOT matrices, manages direct communication channels, and tracks follow-up pipeline progression in a unified dashboard.

---

## 🚀 Key Features

### 1. Lead Discovery & Intelligent Scanner
* **Multi-Country Filters**: Discover small businesses across **USA**, **United Kingdom**, **Germany**, and **Canada** with support for custom country queries.
* **Smart Niche Profiling**: Instantly filter prospects by popular niches like *Plumbing*, *Roofing*, *Dentists*, *Auto Mechanics*, *Bakeries*, *Hair Salons*, or *Local Restaurants*.
* **Status Timeline Synchronizer**: Real-time cloud progress synchronizer with Firebase Firestore databases.

### 2. Multi-Select Kanban Batch Pipeline
* **Multi-Select Bulk Manager**: Toggle precise check selections on multiple leads to update pipeline statuses simultaneously or batch-disenroll records.
* **Dynamic Spreadsheet Export**: Export bulk-selected accounts instantly into structured CSV ledger files ready for immediate importing into any standard CRM.
* **Color-Coded Pipeline Stages**: Visually coordinate leads by tracking progress through six distinct, high-contrast statuses:
  * `🆕 New Prospect`
  * `📞 Contacted`
  * `✉️ Pitch Sent`
  * `🤝 Negotiating`
  * `🎉 Account Won`
  * `🛑 Disqualified`

### 3. Smart Geographic Mapping
* **Mini-Map Layout Previews**: Features an embedded geo-location preview map container right inside the details view, highlighting the business's current location relative to landmarks.
* **Navigation Links**: One-click shortcuts directly into Google Maps for route mapping and physical outreach planning.

### 4. Custom Categorization & Color Tags
* **Custom Labeled Tags**: Label leads with custom categorized hashtags such as `#high-priority`, `#follow-up`, or `#warm`.
* **Smart Palette Highlighting**: Tags are color-coded depending on keyword importance to allow busy field reps to quickly prioritize high-value targets.

### 5. Multi-Channel Outreach Playbooks
* **Gemini Outreach Engine**: Powered by advanced server-side Gemini models to instantly generate dedicated phone pitches and professional email drafts.
* **SWOT Competitive Matrix**: Live generation of competitive analysis (Strengths, Weaknesses, Opportunities, Threats) to immediately arm sales reps with actionable talking points.
* **Direct Desktop Mail Integration**: Direct **Compose Email** launcher buttons that generate a `mailto:` link populated with pre-filled subjects and email bodies, launching directly in the user's desktop or mobile email client.

---

## 🛠️ Technology Stack

* **Frontend**: React (v18+) with Vite, Styled via Tailwind CSS
* **Backend**: Express Server Integration
* **Database**: Cloud Firestore Databases (Firebase SDK)
* **AI Engine**: `@google/genai` TypeScript SDK (utilizing Gemini models)
* **Icon Set**: Lucide React
* **Maps**: Standard Map Embed APIs with OpenStreetMap geometry configuration

---

## 📦 Getting Started & Commands

### Prerequisites
Make sure you have Node.js installed on your machine. Be sure to configure `.env` variables accordingly.

```env
# .env.example
GEMINI_API_KEY=your_gemini_api_key_here
FIREBASE_PROJECT_ID=your_firebase_project_id_here
```

### Installation
1. Install necessary workspace dependencies:
   ```bash
   npm install
   ```

2. Run the local development server:
   ```bash
   npm run dev
   ```

3. Build the server-side bundled scripts and client site for production deployment:
   ```bash
   npm run build
   ```

4. Launch production server:
   ```bash
   npm run start
   ```
