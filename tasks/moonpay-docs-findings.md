# MoonPay documentation findings

Retrieved 2026-08-23 from official MoonPay Developer Docs.

- URL signing: https://dev.moonpay.com/widget/on-ramp/customization/url-signing
  - Generate an HMAC-SHA256 using the MoonPay secret API key as the HMAC key and the original URL query string as the message.
  - For URL-based integrations, URL-encode each query parameter value before generating the signature and return the full signed URL with `signature` appended.
  - The docs distinguish URL-based integration from SDK integration. For SDK integration, return the signature and call `updateSignature`; do not encode the signature because the SDK handles it.
- Web SDK: https://dev.moonpay.com/widget/on-ramp/integration-methods/sdks/web
  - Install `@moonpay/moonpay-js`.
  - Import `loadMoonPay` from `@moonpay/moonpay-js`.
  - `loadMoonPay` returns the SDK constructor. The SDK supports overlay, embedded, new-tab, and new-window variants.
  - When using `walletAddress` or `walletAddresses`, generate a signing URL via `moonPaySdk.generateUrlForSigning()`, sign it on the backend, then call `moonPaySdk.updateSignature(signature)` before showing the widget.
- Official docs also point to the MoonPay Node SDK for server-side signing, but the requested implementation can use Node's built-in crypto HMAC if the repository does not need that additional dependency.

- Webhook signing: https://dev.moonpay.com/api-reference/widget/webhooks/signature
  - The official header is `Moonpay-Signature-V2`, not the user-requested `MoonPay-Signature` spelling.
  - Header format is `t=<unix timestamp>,s=<hex signature>`.
  - For POST requests, sign the exact string `<timestamp>.<raw JSON body>` with HMAC-SHA256 using the MoonPay webhook API key from the Developers page.
  - Verification must compare the supplied signature to the expected signature and should enforce a timestamp tolerance to limit replay risk.

- Transaction webhook event: https://dev.moonpay.com/api-reference/widget/webhooks/transaction-created
  - MoonPay documents both legacy `Moonpay-Signature` and preferred `Moonpay-Signature-V2`; both use `t=<timestamp>,s=<signature>` and HMAC-SHA256 over `<timestamp>.<request body>`. The implementation should prefer V2 and optionally accept legacy only if explicitly needed for migration.
  - The event body contains `type` and `data`; `data` is the Buy transaction object and may include `status: "completed"`, a transaction `id`, wallet address, currency, and other transaction fields.
  - `externalCustomerId` is documented as an identifier supplied by the integrator and is present inside `data`; use a server-generated order/payment identifier rather than accepting an arbitrary client user ID as fulfillment authority.

- Quickstart: https://dev.moonpay.com/widget/on-ramp/quickstart
  - Sandbox is selected with `environment: "sandbox"`; the documented npm SDK example uses `flow: "buy"`, `variant: "overlay"`, and a test publishable key.
  - The documented widget parameters use `baseCurrencyCode`, `baseCurrencyAmount`, and `defaultCurrencyCode`; `currencyCode` is the preferred crypto asset selector in the current SDK types.
  - MoonPay warns that test cards must only be used with a sandbox widget.

- The official URL-signing page includes a fixed verification vector. The HMAC message is the full URL query string including the leading `?`, not just the query contents. The URL signature is base64-encoded and appended as a URL-encoded `signature` parameter. Query parameter order and encoded values must remain unchanged after signing.
- Official URL-signing source: https://dev.moonpay.com/widget/on-ramp/customization/url-signing
- The user-requested `MoonPay-Signature` header naming is not the preferred current contract. The official current header is `Moonpay-Signature-V2`; the implementation will use `MOONPAY_WEBHOOK_SECRET` as the environment variable name while documenting that it must contain MoonPay's webhook API key.
