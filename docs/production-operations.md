# LeadsRadar Production Operations

## Runtime contract

LeadsRadar runs as a Vite-built browser application plus the bundled Express server in `dist/server.cjs`. Production must run with `NODE_ENV=production`, an HTTPS `APP_URL`, a valid `ENCRYPTION_KEY`, a Firebase Admin service-account configuration, and a Gemini API key. Demo fallbacks are disabled automatically in production.

| Variable | Required | Purpose |
|---|---:|---|
| `NODE_ENV` | Yes | Set to `production` for fail-closed behavior. |
| `PORT` | No | Listening port; defaults to `3000`. |
| `APP_URL` | Yes | Absolute HTTPS application URL used for payment callbacks. |
| `ALLOWED_ORIGINS` | Recommended | Comma-separated additional trusted browser origins. |
| `GEMINI_API_KEY` | Yes | Grounded AI discovery and Pro assistance. |
| `FIREBASE_SERVICE_ACCOUNT` | Yes | Server-side Firebase Admin credentials as a JSON string. |
| `ENCRYPTION_KEY` | Yes | At least 32 UTF-8 bytes for authenticated Gmail-token encryption. Store in a secret manager. |
| `PAYSTACK_SECRET_KEY` | Yes for billing | Server-side Paystack secret used for initialization, verification, and webhook signature checks. |
| `PAYSTACK_CURRENCY` | No | Merchant currency; defaults to `USD`. |
| `JSON_BODY_LIMIT` | No | Express request limit; defaults to `256kb`. |
| `FIREBASE_*` client values | Yes | Existing browser Firebase configuration used by the client application. |

## Authentication and authorization

Every `/api` route except `/api/config` and the signed `/api/paystack/webhook` endpoint requires a Firebase ID token in the `Authorization: Bearer <token>` header. The server verifies the token and derives the principal UID from the verified claims. Caller-supplied UID fields are not trusted for protected operations.

Premium operations are gated on the server by the server-owned user profile. Client localStorage is not an authority source. Subscription fields and provider credentials must be changed only through server-side workflows.

## Billing

Paystack checkout initialization is server-owned. The browser returns from Paystack with a transaction reference and calls `/api/paystack/verify`; the server verifies the transaction through Paystack before granting Pro access. Configure the Paystack webhook URL as:

```text
https://YOUR_APP_URL/api/paystack/webhook
```

Paystack webhooks must be configured with the same secret key used by the server. The webhook handler validates `x-paystack-signature`, acknowledges promptly, and fulfills successful transactions idempotently by reference. Never grant Pro based only on a browser redirect, client-selected UID, or client-controlled subscription document write.

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

Deploy immutable build artifacts and retain the previous release artifact. Roll back the application server and static assets together if an API contract or client bundle mismatch occurs. Do not roll back Firestore rules independently of the client/server version unless the rules change is confirmed backward-compatible. Payment fulfillment is idempotent by transaction reference, so replayed webhook delivery must not create duplicate subscription records.

## Incident checks

For authentication failures, inspect request IDs and Firebase Admin initialization without logging tokens. For payment issues, inspect Paystack reference, provider status, and request ID without logging email addresses, secret keys, access tokens, or raw provider response bodies. For Gmail failures, verify the private integration document exists, the encryption key is unchanged, and the provider token has not been revoked.

## Usage quotas

Grounded discovery consumes a daily search allowance in a server-side Firestore usage document keyed by the verified Firebase UID and UTC calendar day. The server reads the subscription tier from the server-owned profile, applies the free or Pro limit, and increments usage transactionally. The browser’s local planner state is only a convenience and is not an entitlement boundary. The generic Express IP limiter remains a separate abuse-control layer and must not be treated as the product quota.

The `usage/{uid}_{YYYY-MM-DD}` documents are written by the Admin SDK and are not client-readable or client-writable under the current deny-by-default rules. If a deployment requires tenant-level billing, pooled quotas, or refunds for provider failures, extend this module with an explicit ledger/idempotency model rather than trusting client counters.
