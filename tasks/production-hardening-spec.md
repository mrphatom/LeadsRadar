# Specification: LeadsRadar Production Hardening

## Objective

Convert LeadsRadar from a prototype/demo workspace into a production-ready multi-tenant web application while preserving its core product direction: authenticated lead discovery, CRM pipeline management, AI-assisted outreach, enrichment, analytics, and optional Gmail/MoonPay integrations.

Production mode must be safe by default. Demo, mock, heuristic, and sandbox behavior may remain available for local development and controlled preview environments, but it must be explicit, visibly labeled, and impossible to activate accidentally in production.

## Assumptions

1. The existing Firebase Authentication and Firestore architecture remains the primary identity and persistence layer.
2. The existing Express server remains the API boundary and will verify Firebase ID tokens on protected routes.
3. Gemini, MoonPay, and Gmail remain supported integrations; external credentials are supplied through environment variables or managed deployment secrets.
4. No destructive database migration or live-cloud rule deployment will be performed automatically in this task.
5. The migration is implemented on a feature branch with atomic commits and verified locally. Deployment, credential rotation, and production rule publication remain explicit operator actions.
6. Existing user-facing API response fields should remain backward-compatible unless retaining a field would create a security or factuality defect.

## Success criteria

| Area | Acceptance criterion |
|---|---|
| Authentication | Every protected API route rejects missing, invalid, expired, or wrong-audience Firebase ID tokens with `401`; route handlers derive identity from the verified token, never from arbitrary request `uid`. |
| Authorization | Resource operations enforce ownership and plan permissions server-side; a user cannot read or mutate another user’s profile, leads, tokens, or queries. |
| Payments | A successful MoonPay checkout cannot grant Pro without a verified signed webhook event, a server-created order, and a treasury-wallet match; sandbox activation is disabled in production. |
| Secrets | No fallback encryption key exists in production; secrets and full tokens never appear in logs or client-readable documents. |
| Validation | Every API boundary validates input and provider responses with bounded schemas; oversized or malformed payloads return structured `4xx` responses. |
| Errors | All API failures use one stable envelope: `{ error: { code, message, requestId } }`; production responses do not expose stack traces or provider internals. |
| Factuality | Synthetic, heuristic, and unverified data is labeled as such; missing contact data is not converted into plausible but unverified contact details. |
| Persistence | Failed Firestore writes surface a recoverable sync state; optimistic UI behavior cannot silently imply durable persistence. |
| Observability | Requests have correlation IDs; logs are structured, redacted, and include route/status/duration; health/readiness endpoints reflect actual dependency state. |
| Performance | Initial bundle is code-split around rarely used workbenches and avoids a significant regression from the current ~1.13 MB minified chunk. |
| Quality | Unit/API/rule regression tests cover authorization, validation, payment gating, fallback labeling, CSV export, and failure recovery. `npm test`, `npm run lint`, and `npm run build` pass. |
| Reproducibility | One authoritative package manager and lockfile are used; clean frozen install succeeds in CI. |

## Commands

```bash
npm install
npm test
npm run lint
npm run build
npm run dev
```

For focused validation during implementation:

```bash
npm test -- --runInBand tests/security.test.ts
npm test -- --runInBand tests/api.test.ts
```

## Target project structure

```text
server.ts                         Express composition and route registration
src/server/                       Auth, validation, errors, logging, providers
src/server/providers/              Gemini, MoonPay, Gmail adapters
src/lib/                          Shared browser-safe domain utilities
src/components/                   UI components and focused workbenches
tests/                            Unit and API regression tests
docs/                             Deployment, operations, security, and ADRs
tasks/                            Specification, plan, and task checklist
firestore.rules                    Deny-by-default tenant rules
```

The existing large components may be split incrementally. No broad presentation rewrite is required for the first security slice.

## API contract

All protected routes use `Authorization: Bearer <Firebase ID token>`. The server creates or propagates an `x-request-id` value and returns it in both the header and error envelope.

```typescript
interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
```

Validation errors use `422`; missing authentication uses `401`; failed ownership/plan checks use `403`; missing resources use `404`; conflicts use `409`; unexpected failures use `500` with a generic message.

## Security boundaries

### Always do

- Verify Firebase ID tokens at the server boundary.
- Derive principal identity from verified claims.
- Validate and bound every request body and external response.
- Enforce tenant ownership and plan permissions in server code and Firestore rules.
- Use authenticated encryption for stored integration tokens and require production keys.
- Redact tokens, passwords, message bodies, full emails, and provider response bodies from logs.
- Apply security headers, explicit JSON body limits, CORS allowlisting, timeouts, and rate limits.
- Label fallback data honestly and preserve source/provenance metadata.
- Run focused tests after each slice and the full suite before every commit.

### Ask first

- Deploying rules or migrations to live Firebase.
- Rotating, revoking, or replacing external credentials.
- Changing MoonPay product amounts, currencies, treasury wallet, or webhook configuration.
- Removing demo behavior entirely.
- Introducing a queue or scheduled worker that creates paid-provider traffic.

### Never do

- Trust client-provided `uid`, `subscriptionTier`, payment success, roles, or ownership fields.
- Log access tokens, encrypted token material, passwords, full request bodies, or full provider responses.
- Use a hard-coded production secret or unauthenticated encryption mode.
- Claim verification when data was synthesized or only heuristically inferred.
- Return provider stack traces or raw exception messages to production clients.
- Use client-only quotas or localStorage as an authorization boundary.

## Testing strategy

Small unit tests cover schemas, redaction, error mapping, factuality labels, fallback transformations, CSV escaping, and subscription policy. Medium API tests use an in-memory/fake provider boundary to cover authentication, ownership, validation, rate limits, and payment state transitions without contacting live services. Firestore rules tests cover user/profile, lead, and query ownership and field restrictions. A small number of browser tests cover sign-in gating, lead update failure recovery, and the disabled production sandbox path.

Tests must be deterministic, isolated, and state-based. External Gemini, MoonPay, Gmail, and Firebase calls are mocked only at the provider boundary.

## Implementation order

1. Baseline and package-manager authority.
2. Shared API errors, request IDs, validation, and authentication middleware.
3. Server-side ownership/plan checks and hardened payment/Gmail routes.
4. Firestore rules and profile/subscription authority.
5. Factuality-safe fallbacks and persistence recovery.
6. Frontend bug fixes, code splitting, and explicit production/demo flags.
7. Tests, CI gates, operational docs, and final review.

## Open questions

- Which deployment platform and domain will be used for production?
- Should Gmail access tokens move to a dedicated server-side secret store, or is an authenticated Firestore token vault acceptable for the first production release?
- Which MoonPay webhook key, treasury wallet, product amounts, and supported currencies will be used in the live account?
- Is the weekly updater required for the first production release, or should it remain disabled until a durable worker and notification channel exist?
- Which observability backend should receive structured logs and metrics?
