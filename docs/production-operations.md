# LeadsRadar Production Operations

## Runtime contract

LeadsRadar runs as a Vite-built browser application plus the bundled Express server in `dist/server.cjs`. Production must run with `NODE_ENV=production`, an HTTPS `APP_URL`, a valid `ENCRYPTION_KEY`, a Firebase Admin service-account configuration, and a Gemini API key. Demo fallbacks are disabled automatically in production.

| Variable | Required | Purpose |
|---|---:|---|
| `NODE_ENV` | Yes | Set to `production` for fail-closed behavior. |
| `PORT` | No | Listening port; defaults to `3000`. |
| `APP_URL` | Yes | Absolute HTTPS application URL used for the MoonPay completion redirect. |
| `ALLOWED_ORIGINS` | Recommended | Comma-separated additional trusted browser origins. |
| `GEMINI_API_KEY` | Yes | Grounded AI discovery and Pro assistance. |
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

## Authentication and authorization

Every `/api` route except `/api/config` and the signed `/api/webhooks/moonpay` endpoint requires a Firebase ID token in the `Authorization: Bearer <token>` header. The server verifies the token and derives the principal UID from the verified claims. Caller-supplied UID fields are not trusted for protected operations.

Premium operations are gated on the server by the server-owned user profile. Client localStorage is not an authority source. Subscription fields and provider credentials must be changed only through server-side workflows.

## Billing

MoonPay checkout initialization is server-owned. The authenticated browser requests `/api/moonpay/sign-url?period=month` or `period=year`; the server creates a pending order, builds the complete widget URL, signs it with `MOONPAY_SECRET_KEY`, and returns it. The browser launches `@moonpay/moonpay-js` in the sandbox or production environment and applies the returned signature with `updateSignature()` before showing the overlay.

Configure the MoonPay webhook URL as:

```text
https://YOUR_APP_URL/api/webhooks/moonpay
```

Configure MoonPay to send transaction events to this endpoint. The handler verifies `Moonpay-Signature-V2` (accepting the legacy `Moonpay-Signature` format only for compatibility), signs the exact raw body with the configured webhook key, rejects stale timestamps, and processes only `transaction_updated` events with `data.status === "completed"`. It correlates the event to a server-created `moonpay_{uuid}` order and checks the destination wallet before activating Pro. Fulfillment is idempotent through an Admin SDK transaction. Never grant Pro based only on a browser redirect, client-selected UID, arbitrary external transaction ID, or client-controlled subscription document write.

## Credential storage

Gmail access tokens are encrypted with AES-256-GCM and stored under the server-only Firestore path `users/{uid}/integrations/gmail`. The client-readable user profile stores only connection status and display email. A production `ENCRYPTION_KEY` is mandatory; do not use the development fallback in any deployed environment.

When a user disconnects Gmail, the server deletes the private integration document and clears the profile connection status. Rotate the encryption key only with a planned re-encryption migration; changing it without migrating existing ciphertext will make stored tokens unreadable.

## Data quality and fallback behavior

Grounded discovery results carry citation metadata and are eligible for a verified state only when grounding evidence is returned. Missing contact details remain explicit missing-data markers. Local and provider-error fallbacks are labeled synthetic or unverified and must not be used as factual outreach targets without independent verification.

The weekly scan planner is a manual browser-session workflow. It is not a persistent background scheduler. Enterprise deployments that require scheduled scans should add a separately authenticated job runner with a durable queue, idempotency keys, per-tenant quotas, and operational monitoring.

## Deployment gates

Run the following commands from a clean checkout before release:

```bash
npm ci --ignore-scripts
npm run lint
npm test
npm run build
npm run audit
git diff --check
```

The CI workflow runs these checks automatically. The high-severity audit gate currently passes after non-breaking dependency remediation; remaining moderate transitive advisories should be reviewed when upgrading Firebase Admin and its Google Cloud dependency tree.

## Rollback

Deploy immutable build artifacts and retain the previous release artifact. Roll back the application server and static assets together if an API contract or client bundle mismatch occurs. Do not roll back Firestore rules independently of the client/server version unless the rules change is confirmed backward-compatible. MoonPay fulfillment is idempotent by the server-created order and provider transaction ID, so replayed webhook delivery must not create duplicate subscription records.

## Incident checks

For authentication failures, inspect request IDs and Firebase Admin initialization without logging tokens. For payment issues, inspect MoonPay order ID, webhook result, provider status, and request ID without logging wallet addresses, secret keys, access tokens, or raw provider response bodies. For Gmail failures, verify the private integration document exists, the encryption key is unchanged, and the provider token has not been revoked.

## Usage quotas

Grounded discovery consumes a daily search allowance in a server-side Firestore usage document keyed by the verified Firebase UID and UTC calendar day. The server reads the subscription tier from the server-owned profile, applies the free or Pro limit, and increments usage transactionally. The browser’s local planner state is only a convenience and is not an entitlement boundary. The generic Express IP limiter remains a separate abuse-control layer and must not be treated as the product quota.

The `usage/{uid}_{YYYY-MM-DD}` documents are written by the Admin SDK and are not client-readable or client-writable under the current deny-by-default rules. If a deployment requires tenant-level billing, pooled quotas, or refunds for provider failures, extend this module with an explicit ledger/idempotency model rather than trusting client counters.
