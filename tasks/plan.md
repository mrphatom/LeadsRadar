# Production Hardening Implementation Plan

## Baseline

- Branch: `feat/moonpay-fiat-onramp` (based on the hardened `feat/production-hardening` baseline)
- Base revision: `7b559ef`
- Existing validation: TypeScript and production build pass; clean `npm ci` fails due lockfile drift; no tests exist; native audit reports vulnerabilities.
- Safety rule: no live Firebase/MoonPay deployment, webhook configuration, database migration, or credential rotation from this workspace.

## Dependency graph and checkpoints

### Slice 1 — Reproducible toolchain and shared contracts

Normalize the authoritative package manager/lockfile, add the smallest required validation/test/security dependencies, define environment parsing, and add shared API error/request-context utilities. Checkpoint: clean install, unit test runner, typecheck, and build succeed.

### Slice 2 — Server trust boundary

Add Firebase bearer-token verification, request IDs, structured redacted logging, JSON/body limits, security headers, CORS allowlisting, route-level rate limiting, centralized error handling, and schemas for all routes. Checkpoint: unauthenticated, malformed, oversized, and valid requests have deterministic responses.

### Slice 3 — Server authorization and sensitive integrations

Derive UID from verified claims, enforce resource ownership and plan policy, remove caller-controlled subscription/identity inputs, require authenticated encryption keys, harden Gmail routes, and make MoonPay signing/webhook fulfillment explicit. Checkpoint: API regression tests prove cross-user access and unpaid Pro activation are refused.

### Slice 4 — Firestore security contract

Tighten user/lead/query rules, exact field allowlists, ownership checks, valid timestamps/enums, and subscription-field restrictions. Add rule tests or documented emulator verification. Checkpoint: rules align with runtime writes and the security specification.

### Slice 5 — Factuality and persistence integrity

Separate verified, synthetic, and heuristic data; stop fabricating contact details in production; label fallbacks; preserve provenance; fix duplicate persistence and optimistic-write failure handling. Checkpoint: fallback/data-integrity tests pass and UI messages are honest.

### Slice 6 — Frontend performance and UX correctness

Code-split heavy modals, memoize only measured hotspots, fix CSV escaping, service-health claims, scheduler labeling, disabled/empty/error states, and client-only authorization assumptions. Checkpoint: bundle/build and browser smoke tests show no regressions.

### Slice 7 — Operational readiness

Add CI quality gates, migration/deployment runbook, security documentation, API contract documentation, observability notes, changelog, and dependency audit policy. Checkpoint: clean checkout reproduces all required checks.

### Slice 8 — Final verification and review

Run tests, typecheck, build, smoke tests, audit, inspect diff, review security and API contracts, and summarize remaining deployment-specific work. Checkpoint: branch is clean except intentional commits and no unresolved critical findings are hidden.
