## Google Gemini model and SDK verification

Retrieved 2026-08-23 from official sources:

- https://ai.google.dev/gemini-api/docs/models — The current model catalog lists stable endpoints `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, and `gemini-2.5-flash`; it identifies `gemini-2.5-flash` as a stable low-latency, high-volume model and recommends stable model identifiers for production.
- https://ai.google.dev/gemini-api/docs — The official JavaScript example initializes `GoogleGenAI` from `@google/genai` and uses `ai.models.generateContent({ model: 'gemini-2.5-flash', contents: ... })`; the page also documents the generally available Interactions API.
- https://github.com/googleapis/js-genai — The official SDK README states that the JavaScript SDK supports Node.js 20+, warns against client-side API-key exposure, documents `GoogleGenAI` plus `models.generateContent`, and recommends pinning the SDK below 3.0.0 while upcoming breaking changes are pending.

Implication: the repository's current `gemini-3.6-flash` and `gemini-3.5-flash` strings are listed in the current catalog, but the integration should use a deliberate stable production model setting rather than scattering model names; any SDK major upgrade requires explicit compatibility testing.

## Firebase Authentication account linking and Google OAuth scopes

- Source: https://firebase.google.com/docs/auth/web/account-linking
- Retrieved: 2026-08-23
- Evidence: Firebase’s JavaScript documentation recommends `linkWithPopup(auth.currentUser, provider)` for linking a federated provider to the existing Firebase user, preserving the same Firebase user ID. It states that linking fails if the provider credential already belongs to another account and that the app must handle that case explicitly.
- Source: https://firebase.google.com/docs/auth/web/google-signin
- Retrieved: 2026-08-23
- Evidence: Google provider scopes are added with `provider.addScope(...)`; after popup authentication the app can retrieve the Google OAuth access token using `GoogleAuthProvider.credentialFromResult(result)`.
- Application implication: Gmail connection must not use `signInWithPopup` as a secondary integration flow because that can change the active Firebase principal. The implementation should link or reauthenticate the current user, verify the result UID, then send the provider access token to the server.
