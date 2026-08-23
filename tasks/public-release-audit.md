# LeadsRadar Public-Release Audit

## Release position

The public-release hardening pass was completed on branch `fix/evidence-first-discovery`. The branch is pushed to `mrphatom/LeadsRadar` at commit `e885f705caa16833b9c09717212a0407f57d2324`, while the repository default branch `main` remains unchanged. GitHub Actions run `32670345533` completed successfully for this final commit.

This is a code and release-readiness audit, not a claim that the current Render production URL is healthy. The live service was previously switched to the feature branch with explicit confirmation, but its last observed deployment was an older commit and failed during startup because the required MoonPay configuration was absent. No secret value was viewed, entered, rotated, or changed, and no redeploy was triggered during this pass.

## Validation evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| TypeScript | Passed | `npm run lint` completed successfully. |
| Unit/integration tests | Passed | `npm test`: 33 passing and 2 emulator-dependent tests skipped before the explicit rules run. |
| Firestore rules | Passed | `npm run test:rules`: 35 passing, 0 skipped, including owner isolation, immutable identity, and server-owned profile/lead fields. Emulator permission-denied traces are expected assertions from the rules tests. |
| Production build | Passed | Vite and esbuild completed successfully. |
| Dependency audits | Passed | `npm audit --audit-level=high` and `npm audit --omit=dev --audit-level=high` both reported zero vulnerabilities. |
| Whitespace | Passed | `git diff --check` and staged diff checks completed without findings. |
| Secret scan | Passed with documented fixtures | No live-looking provider credentials or private keys were found. The repository contains an intentionally public Firebase browser configuration and a clearly labeled MoonPay test fixture used by unit tests; neither is a production secret. |
| CI | Passed | GitHub Actions run `32670345533`, commit `e885f70`, conclusion `success`. |

The current production build emits a non-fatal large-chunk warning: the main client asset is approximately 787.8 kB minified and 201.7 kB gzip. This is a measurable optimization opportunity, not a release failure; it should be addressed in a separate route/dependency-splitting track with before-and-after measurements.

## Engineering changes completed

The backend now treats Google Places provider responses as the factual authority for discovered business identity, address, status, maps URL, website, phone, and types. Missing email, social, LinkedIn, ranking, traffic, revenue, review, competitor, and audit claims remain explicitly unavailable rather than being inferred or fabricated. Optional Gemini output is routed through a deliberate stable model configuration and is presented as generated guidance, not provider evidence.

MoonPay configuration is now an independently reported capability. Core authentication and provider discovery can boot when billing is not configured, while signed checkout and webhook fulfillment remain fail-closed and return unavailable responses. Pro authorization and quota allocation use a shared expiry-aware subscription policy, so expired or malformed paid records do not retain premium access. Gmail connection links or reauthenticates the existing Firebase principal before transferring an OAuth token to the server, preventing a secondary popup from silently changing the active user.

The client release pass added semantic auth tabs and labels, accessible password visibility controls, focus-managed dialogs with Escape handling and focus return, honest browser-local guest activity wording, server-authoritative quota messaging, non-blocking provider/Gmail error surfaces, and a manual-plan pause guard. Raw client exception objects are no longer emitted by the audited provider and Gmail surfaces. The visual foundation uses a restrained dark liquid-glass system with selective blur, readable borders, transform/opacity-oriented motion, and a reduced-motion override.

The private workspace metadata uses `noindex`, `nofollow`, and `noarchive` because this application is authenticated and is not currently a public marketing site. Product-facing AI Studio/prototype/watermark residue was removed from active source and metadata. Truthful external provider documentation references and historical internal audit evidence were retained where they explain credential acquisition or prior validation.

## Browser and viewport evidence

The available Chromium smoke session rendered the auth surface on a fresh `localhost` origin at 896×768. The evidence-first heading, semantic sign-in/register tabs, labeled fields, Google action, guest action, registration Full Name field, and password visibility toggle were observed. The earlier blank root on the persistent `127.0.0.1` origin was reproduced, narrowed to the browser session/module-cache context, and resolved by testing the same server through a fresh origin; no current source-level blank-screen defect was observed.

A separate configured Playwright browser could not run because its Firefox executable was not installed and the connector did not expose its required browser-install operation. No browser binary or dependency was added. Therefore, a deterministic 320/768/1024/1440 viewport matrix remains an explicit follow-up validation item. Source-level protections include a 320px minimum layout width, responsive grid/filter classes, focus-visible styling, and reduced-motion CSS.

## Render handoff

The live Render service remains unverified after the final branch push because no redeploy was authorized during this pass. The last observed deployment, `dep-da5m7nbtqb8s73atnrlg`, built successfully from the earlier branch commit but failed at startup because these variable names were absent: `MOONPAY_PUBLISHABLE_KEY`, `MOONPAY_SECRET_KEY`, `MOONPAY_WEBHOOK_SECRET`, and `TREASURY_WALLET_ADDRESS`. The user must enter those values privately in the Render service environment, or intentionally operate with billing unavailable under the new code contract. No values should be sent in chat or committed to Git.

After the environment decision is complete, a fresh point-of-action confirmation is required before any redeploy. Only after a successful deployment should `/healthz`, `/readyz`, the auth entry screen, provider-unavailable behavior, and a non-destructive authenticated discovery flow be checked against the live origin. Payment sandbox and Gmail delivery tests require the user’s own provider credentials and must not be simulated as successful.

## Remaining follow-up work

The remaining items are bounded and explicit. The first is a live Render redeploy and health verification after the user privately configures or intentionally leaves billing disabled. The second is a full real-browser viewport matrix once a browser runtime is available. The third is measured main-bundle reduction. The fourth is a separate, isolated patch/minor dependency update review; major migrations for Vite, Express, TypeScript, `@google/genai`, and plugin-react were intentionally deferred because they require separate changelog review and compatibility testing.

## Official references

[1]: https://ai.google.dev/gemini-api/docs/models "Google Gemini API model documentation"
[2]: https://ai.google.dev/gemini-api/docs "Google Gemini API documentation"
[3]: https://github.com/googleapis/js-genai "Official Google GenAI JavaScript SDK"
[4]: https://firebase.google.com/docs/auth/web/account-linking "Firebase account linking documentation"
[5]: https://firebase.google.com/docs/auth/web/google-signin "Firebase Google sign-in documentation"
[6]: https://github.com/actions/setup-java "Official GitHub Actions setup-java repository"

The model-selection, SDK, Firebase account-linking, and CI action decisions recorded above were checked against the official sources [1] [2] [3] [4] [5] [6].
