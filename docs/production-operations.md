# LeadsRadar Production Operations

## Runtime contract

LeadsRadar runs as a Vite-built browser application plus the bundled Express server in `dist/server.cjs`. Production must run on **Node.js 22 or newer** because the application uses Firebase Admin SDK 14. Production must also run with `NODE_ENV=production`, an HTTPS `APP_URL`, a valid `ENCRYPTION_KEY`, a Firebase Admin service-account configuration, and a server-side Google Places API key. Gemini is optional and is used only for clearly labeled generated guidance. Discovery and enrichment fail closed when Google Places is unavailable; no demo or synthetic lead fallback is permitted. MoonPay is an independent capability: missing MoonPay configuration does not block core service readiness, but payment signing and fulfillment remain unavailable until the complete billing configuration is present.

| Variable | Required | Purpose |
|---|---:|---|
| `NODE_ENV` | Yes | Set to `production` for fail-closed behavior. |
| `PORT` | No | Listening port; defaults to `3000`. |
| `APP_URL` | Yes | Absolute HTTPS application URL used for the MoonPay completion redirect. |
| `ALLOWED_ORIGINS` | Recommended | Comma-separated additional trusted browser origins. |
| `GOOGLE_PLACES_API_KEY` | Yes for discovery | Server-side Google Places API key. Discovery and enrichment are unavailable when absent; never expose it to the browser. |
| `GEMINI_API_KEY` | No | Optional generated guidance only; never a source of lead identity or contact facts. |
| `GEMINI_MODEL` | No | Tested model identifier for generated guidance; defaults to `gemini-2.5-flash`. |
| `FIREBASE_SERVICE_ACCOUNT` | Yes | Server-side Firebase Admin credentials as a JSON string. |
| `ENCRYPTION_KEY` | Yes | At least 32 UTF-8 bytes for authenticated Gmail-token encryption. Store in a secret manager. |
| `MOONPAY_ENVIRONMENT` | No | `sandbox` locally and `production` in production; production mode rejects sandbox. |
| `MOONPAY_PUBLISHABLE_KEY` | Yes for billing | MoonPay publishable key included in the signed widget URL. |
| `MOONPAY_SECRET_KEY` | Yes for billing | Server-side MoonPay URL-signing secret. Never expose it to the browser. |
| `MOONPAY_WEBHOOK_SECRET` | Yes for billing | MoonPay webhook API key used to verify `Moonpay-Signature-V2`. |
| `TREASURY_WALLET_ADDRESS` | Yes for billing | Exact destination wallet checked during webhook fulfillment. |
| `MOONPAY_BASE_CURRENCY_CODE` | No | Fiat currency used for the locked plan amount; defaults to `usd`. |
| `MOONPAY_CURRENCY_CODE` | No | Crypto asset sent to the treasury wallet; defaults to `usdc`. |
| `MOONPAY_MONTHLY_AMOUNT` / `MOONPAY_YEARLY_AMOUNT` | No | Locked fiat plan amounts; defaults to `7` and `64`. |
| `JSON_BODY_LIMIT` | No | Express request limit; defaults to `256kb`. |
| `FIREBASE_*` client values | Yes | Existing browser Firebase configuration used by the client application. |

## Health probes

`GET /healthz` is an unauthenticated liveness probe and returns `200` with `{ "status": "ok" }` when the process is running. `GET /readyz` is an unauthenticated readiness probe and returns `200` only after Firebase Admin Auth and Firestore clients initialize; otherwise it returns `503`. Readiness does not imply that optional discovery, guidance, or billing providers are configured. `/api/config` exposes non-secret capability flags so the UI can present those states honestly. Both probe responses are non-cacheable and contain no credentials or provider data. Configure the hosting platform to use `/healthz` for liveness and `/readyz` for readiness.

In production, malformed `FIREBASE_SERVICE_ACCOUNT` JSON or a missing `firebase-applet-config.json` causes startup to fail rather than silently falling back to a potentially incorrect credential source. When `FIREBASE_SERVICE_ACCOUNT` is omitted, the deployment must provide valid Google Application Default Credentials through its managed runtime.

## Authentication and authorization

Every `/api` route except `/api/config` and the signed `/api/webhooks/moonpay` endpoint requires a Firebase ID token in the `Authorization: Bearer <token>` header. The server verifies the token and derives the principal UID from the verified claims. Caller-supplied UID fields are not trusted for protected operations.

Premium operations are gated on the server by the server-owned user profile. Client localStorage is not an authority source. Subscription fields and provider credentials must be changed only through server-side workflows.

## Billing

MoonPay checkout initialization is server-owned. The authenticated browser requests `/api/moonpay/sign-url?period=month` or `period=year`; the server creates a pending order, builds the complete widget URL, signs it with `MOONPAY_SECRET_KEY`, and returns it. The browser launches `@moonpay/moonpay-js` in the sandbox or production environment and applies the returned signature with `updateSignature()` before showing the overlay. If any of the four billing variables is missing, `/api/config` reports `billingAvailable: false`, the checkout control remains unavailable, and the signing and webhook endpoints return `503` without creating orders or activating subscriptions.

Configure the MoonPay webhook URL as:

```text
https://YOUR_APP_URL/api/webhooks/moonpay
```

Configure MoonPay to send transaction events to this endpoint. The handler verifies `Moonpay-Signature-V2` (accepting the legacy `Moonpay-Signature` format only for compatibility), signs the exact raw body with the configured webhook key, rejects stale timestamps, and processes only `transaction_updated` events with `data.status === "completed"`. It correlates the event to a server-created `moonpay_{uuid}` order and checks the destination wallet before activating Pro. Fulfillment is idempotent through an Admin SDK transaction. Never grant Pro based only on a browser redirect, client-selected UID, arbitrary external transaction ID, or client-controlled subscription document write.

## Credential storage

Gmail access tokens are encrypted with AES-256-GCM and stored under the server-only Firestore path `users/{uid}/integrations/gmail`. The client-readable user profile stores only connection status and display email. A production `ENCRYPTION_KEY` is mandatory; do not use the development fallback in any deployed environment.

When a user disconnects Gmail, the server deletes the private integration document and clears the profile connection status. Rotate the encryption key only with a planned re-encryption migration; changing it without migrating existing ciphertext will make stored tokens unreadable.

## Provider evidence and fallback behavior

Google Places Text Search (New) and Place Details (New) are the only lead identity/contact discovery sources. Requests use narrow field masks and map only fields returned by the provider: stable Place ID, provider display name, formatted address, operational status, Maps URI, listed website URI, listed phone, and provider category when present. Permanently closed records are excluded. A listed website is a provider-returned filter condition; it is not a claim that no other website exists.

Each mapped record includes the provider source ID, source URL, retrieval timestamp, and explicit missing markers for email, LinkedIn, and social profiles. A browser-persisted result is marked `client-provided` and must not be treated as server-authoritative verification. Only an Admin SDK/provider persistence workflow may set `server-provider` authority. Missing fields and provider failures are never filled with generated values.

Gemini output is untrusted planning guidance. It must not assert measured traffic, revenue loss, rankings, reviews, competitor identities, prior audits, contact attempts, or delivery events unless those facts are supplied by an evidence-returning system or the operator. LinkedIn intelligence is unavailable until a dedicated evidence-returning provider is configured.

The weekly scan planner is a manual browser-session workflow. It is not a persistent background scheduler. Enterprise deployments that require scheduled scans should add a separately authenticated job runner with a durable queue, idempotency keys, per-tenant quotas, and operational monitoring.

## Deployment gates

Run the following commands from a clean checkout before release:

```bash
npm ci --ignore-scripts
npm run lint
npm test
npm run build
npm run audit
npm run audit:runtime
git diff --check
```

The CI workflow runs these checks automatically. The Firebase Admin 14 migration must be validated on Node 22 in CI and in the deployment runtime. Root npm overrides pin `uuid` to `11.1.1` and `@opentelemetry/core` to `2.8.0`. The first covers the supported Google Cloud Storage 7.x uuid range; the second covers the Firebase CLI 15 Pub/Sub telemetry range. Both were tested against the application and Firestore emulator suites. Re-evaluate and remove each override when its supported upstream dependency graph no longer needs it; do not replace this policy with `npm audit fix --force`.

## Node and dependency migration

Firebase Admin SDK 14 is a breaking major release. It drops Node.js 18 and 20 support, so the deployment image, local runtime, CI setup, and any process manager configuration must all use Node.js 22 or newer. The application uses modern Admin entrypoints and does not use the removed legacy namespace, Instance ID API, or legacy FCM messaging methods. Keep the previous immutable artifact available for rollback, but do not roll back only the server dependency while retaining a client or rules artifact that expects a different API contract.

The dependency migration is complete only when `npm ci --ignore-scripts` reproduces the committed lockfile, the application and Firestore emulator suites pass, the production build succeeds, the server starts with production configuration, and `npm audit --omit=dev` is reviewed. Do not use broad npm overrides or `npm audit fix --force` as a substitute for the supported Firebase Admin upgrade.

## Rollback

Deploy immutable build artifacts and retain the previous release artifact. Roll back the application server and static assets together if an API contract or client bundle mismatch occurs. Do not roll back Firestore rules independently of the client/server version unless the rules change is confirmed backward-compatible. MoonPay fulfillment is idempotent by the server-created order and provider transaction ID, so replayed webhook delivery must not create duplicate subscription records.

## Incident checks

For authentication failures, inspect request IDs and Firebase Admin initialization without logging tokens. For payment issues, inspect MoonPay order ID, webhook result, provider status, and request ID without logging wallet addresses, secret keys, access tokens, or raw provider response bodies. For Gmail failures, verify the private integration document exists, the encryption key is unchanged, and the provider token has not been revoked.

## Usage quotas

Google Places discovery consumes a daily search allowance in a server-side Firestore usage document keyed by the verified Firebase UID and UTC calendar day. The server reads the subscription tier from the server-owned profile, applies the free or Pro limit, and increments usage transactionally. The browser’s local planner state is only a convenience and is not an entitlement boundary. The generic Express IP limiter remains a separate abuse-control layer and must not be treated as the product quota.

The `usage/{uid}_{YYYY-MM-DD}` documents are written by the Admin SDK and are not client-readable or client-writable under the current deny-by-default rules. If a deployment requires tenant-level billing, pooled quotas, or refunds for provider failures, extend this module with an explicit ledger/idempotency model rather than trusting client counters.
