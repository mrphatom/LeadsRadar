# LeadsRadar — Webless Business Tracker & Outreach Workspace

LeadsRadar is a responsive full-stack B2B outreach workspace built using React, Vite, Tailwind CSS, Express, and Google Cloud Firestore. It helps sales departments, independent agencies, and business development officers organize provider-sourced business records and user-provided leads across the **USA, United Kingdom, Germany, and Canada**.

The application keeps business identity and contact facts separate from optional generated guidance. Provider records include source links and retrieval timestamps; fields not returned by a provider remain explicitly unlisted. Outreach drafts, strategy hypotheses, and conversation assistance are non-factual working material that must be reviewed before use.

---

## 🚀 Key Features

### 1. Lead Discovery & Intelligent Scanner
* **Google Places provider discovery**: Search structured Google Places records across supported or custom territories. The server returns only provider fields and source citations; missing email, social, LinkedIn, and rating data is not inferred.
* **Smart Niche Profiling**: Query categories such as *Plumbing*, *Roofing*, *Dentists*, *Auto Mechanics*, *Bakeries*, *Hair Salons*, or *Local Restaurants*.
* **Status Timeline Synchronizer**: Real-time workspace synchronization with Firebase Firestore, with synthetic legacy records hidden from the active workspace.

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
* **Generated outreach guidance**: Optional server-side Gemini drafts are based on the lead fields supplied to the request and are labeled as guidance. They must not claim an audit, review, contact, ranking, traffic, revenue, or competitor fact that is not independently evidenced.
* **Strategy hypothesis matrix**: Generate planning prompts and validation questions; the application does not measure SEO traffic, revenue loss, rankings, reviews, or competitor counts.
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
Use **Node.js 22 or newer**. Firebase Admin SDK 14 requires Node 22+, and the repository pins the expected major runtime in `.nvmrc`. Be sure to configure `.env` variables according to [`docs/deployment-secrets.md`](docs/deployment-secrets.md).

```env
# .env.example
GOOGLE_PLACES_API_KEY=your_server_side_google_places_key_here
GEMINI_API_KEY=optional_guidance_only
FIREBASE_SERVICE_ACCOUNT=your_server_side_firebase_service_account_here
ENCRYPTION_KEY=your_server_side_encryption_key_here
```

### Installation
1. Install the locked workspace dependencies:
   ```bash
   npm ci --ignore-scripts
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


## Production deployment

LeadsRadar defaults to fail-closed production behavior. Run the server on **Node.js 22 or newer** and configure `NODE_ENV=production`, an HTTPS `APP_URL`, `GOOGLE_PLACES_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, and `ENCRYPTION_KEY` with at least 32 UTF-8 bytes. `GEMINI_API_KEY` is optional and is used only for clearly labeled generated guidance. MoonPay billing additionally requires `MOONPAY_PUBLISHABLE_KEY`, `MOONPAY_SECRET_KEY`, `MOONPAY_WEBHOOK_SECRET`, and `TREASURY_WALLET_ADDRESS`; set `MOONPAY_ENVIRONMENT=sandbox` locally and `production` in production. Optional pricing/currency values are `MOONPAY_BASE_CURRENCY_CODE`, `MOONPAY_CURRENCY_CODE`, `MOONPAY_MONTHLY_AMOUNT`, and `MOONPAY_YEARLY_AMOUNT`. See [`docs/deployment-secrets.md`](docs/deployment-secrets.md) for the complete secret acquisition/configuration guide and [`docs/production-operations.md`](docs/production-operations.md) for the environment contract, MoonPay signed checkout and webhook setup, credential-storage model, incident checks, and rollback procedure. For a safe local provider test, follow [`docs/moonpay-sandbox-testing.md`](docs/moonpay-sandbox-testing.md). A sample production Docker Compose deployment is available in [`docker-compose.production.yml`](docker-compose.production.yml), with an optional systemd lifecycle unit at [`deploy/leadsradar.service.example`](deploy/leadsradar.service.example); use them with an external, permission-restricted environment file as described in [`docs/deployment-secrets.md`](docs/deployment-secrets.md). For Render, review [`render.yaml`](render.yaml) and the manually gated [Render deployment workflow](.github/workflows/deploy-render.yml); the workflow requires a successful CI status and the `RENDER_DEPLOY_HOOK_URL` GitHub Actions environment secret.

All protected API calls require a verified Firebase ID token. Pro access and subscription state are server-authoritative and are never granted from browser localStorage or a client-controlled Firestore write. Gmail tokens are encrypted and stored outside the client-readable profile document. Google Places discovery responses expose provider citations, source IDs, and retrieval timestamps. There is no demo/mock lead fallback: if the provider is unavailable or unconfigured, discovery and enrichment return an unavailable response. Existing synthetic legacy records are hidden from the active workspace but are not deleted automatically.

The weekly scan planner is a manual browser-session workflow, not a persistent background scheduler. A durable scheduler requires a separately authenticated job runner and queue.

Google Places discovery enforces the daily search allowance on the server, using the verified Firebase UID, UTC calendar day, and the subscription tier stored by the server. Free and Pro limits are not controlled by browser localStorage. The generic Express IP rate limiter is an abuse-control layer and is intentionally separate from product entitlement.

Provider failures do not create business facts. Missing contact fields remain explicit, LinkedIn intelligence is unavailable without a dedicated evidence-returning provider, and browser-created records are marked user/client-provided rather than server-verified. Before release, follow [`docs/production-operations.md`](docs/production-operations.md) and [`security_spec.md`](security_spec.md). No Firebase rules, MoonPay configuration, credential rotation, database migration, or cloud deployment is performed by this workflow.

## MoonPay sandbox testing

Use `MOONPAY_ENVIRONMENT=sandbox` with MoonPay test keys only. The browser opens the official MoonPay overlay through `@moonpay/moonpay-js`; Pro activation is still controlled by the signed webhook and server-created order. See [`docs/moonpay-sandbox-testing.md`](docs/moonpay-sandbox-testing.md) for the complete local workflow.

## Validation

Use the locked dependency and production validation workflow before release:

```bash
npm ci --ignore-scripts
npm run lint
npm test
npm run build
npm run audit
npm run audit:runtime
git diff --check
```

The repository includes a GitHub Actions workflow at [`.github/workflows/ci.yml`](.github/workflows/ci.yml) that runs these quality gates on pushes and pull requests.
