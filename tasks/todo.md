# Production Hardening Task Checklist

- [ ] Normalize package manager and lockfile; remove unused dependency declarations.
  - Acceptance: one frozen install succeeds and package metadata is consistent.
  - Verify: `npm ci`, `npm audit --omit=dev`.

- [ ] Add shared environment validation and production-mode guards.
  - Acceptance: unsafe fallbacks fail closed in production and are explicit in preview/dev.
  - Verify: environment unit tests and startup smoke tests.

- [ ] Add structured API error envelope and request correlation.
  - Acceptance: all route failures include stable code/message/requestId and no raw internals.
  - Verify: API tests for validation/provider/internal failures.

- [ ] Add Firebase ID-token authentication middleware.
  - Acceptance: missing/invalid/expired tokens return 401; verified UID is the only principal identity.
  - Verify: auth middleware unit/API tests.

- [ ] Add API schemas, body limits, security headers, CORS, rate limits, and timeouts.
  - Acceptance: malformed/oversized/rate-limited requests are rejected consistently.
  - Verify: boundary tests and header smoke test.

- [ ] Enforce ownership and Pro policy on sensitive routes.
  - Acceptance: cross-user profile/Gmail/lead operations and unauthorized paid features are denied.
  - Verify: API authorization tests.

- [ ] Harden Gmail token storage and outbound operations.
  - Acceptance: production requires authenticated encryption key; no token/PII leakage in logs; Gmail operations use verified principal.
  - Verify: crypto and redaction tests.

- [ ] Replace unverified contact fabrication with provenance-safe fallback behavior.
  - Acceptance: synthetic data is labeled and never marked verified in production.
  - Verify: sanitizer/provider fallback tests.

- [ ] Tighten Firestore rules and align blueprint/runtime fields.
  - Acceptance: owner-only profile reads, exact mutable field sets, valid timestamps/enums, protected subscription fields.
  - Verify: emulator/rules tests or documented emulator checks.

- [ ] Make client persistence failures visible and recoverable.
  - Acceptance: failed writes surface sync failure and provide retry/reload path; duplicate saves are not persisted.
  - Verify: persistence unit/integration tests.

- [ ] Fix frontend correctness and performance hotspots.
  - Acceptance: CSV escaping, health/status text, scheduler wording, and async states are correct; initial bundle improves or does not regress.
  - Verify: build plus browser smoke/performance checks.

- [ ] Add CI, operations/security documentation, and changelog.
  - Acceptance: CI runs install, tests, lint/typecheck, build, and audit; runbook describes required secrets and deployment gates.
  - Verify: CI workflow validation and clean-checkout reproduction.

- [ ] Complete final diff/security review.
  - Acceptance: no accidental secrets, no unresolved critical authorization defect, no uncommitted generated artifacts.
  - Verify: `git diff --check`, tests, lint, build, audit, and manual review.
