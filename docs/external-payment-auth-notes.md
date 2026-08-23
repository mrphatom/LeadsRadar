# External implementation notes

## Firebase ID-token verification

Source: https://firebase.google.com/docs/auth/admin/verify-id-tokens

Firebase’s official guidance says a client should send its ID token to a custom backend over HTTPS; the backend must verify the token’s integrity and authenticity, then use the UID from the verified token to identify the user. The Admin SDK `verifyIdToken()` checks token format, expiry, and signature. This application uses the revocation-check option for protected API requests. Payment fulfillment never trusts a browser-provided UID or subscription flag.

## MoonPay URL signing

Source: https://dev.moonpay.com/widget/on-ramp/customization/url-signing

MoonPay documents HMAC-SHA256 URL signing with the account secret key. The message is the original URL query string including its leading `?`; query parameter values must already be URL-encoded and their order must not change after signing. URL-based integrations append a base64 signature as a URL-encoded `signature` parameter. The application builds the complete URL server-side, signs it with `MOONPAY_SECRET_KEY`, and returns the signed URL to the authenticated browser. The publishable key is safe for the widget URL; the secret key is never sent to the client.

The fixed MoonPay documentation vector is covered by `tests/moonpay.test.ts`, including the leading `?` and URL-encoded base64 signature requirements.

## MoonPay Web SDK

Source: https://dev.moonpay.com/widget/on-ramp/integration-methods/sdks/web

The browser imports `loadMoonPay` from `@moonpay/moonpay-js`, initializes the `buy` flow with the sandbox or production environment, and uses the overlay variant. Because the server returns a signed URL, the client removes the signature from the parameter object, calls `updateSignature(signature)`, and then calls `show()`.

## MoonPay webhooks

Sources: https://dev.moonpay.com/api-reference/widget/webhooks/signature and https://dev.moonpay.com/api-reference/widget/webhooks/transaction-created

MoonPay’s current preferred webhook header is `Moonpay-Signature-V2`, with the legacy `Moonpay-Signature` format documented for compatibility. Both contain `t=<unix timestamp>,s=<signature>`. The signature is an HMAC-SHA256 over `<timestamp>.<raw request body>` using the MoonPay webhook API key. The application verifies the raw body before parsing JSON, enforces a five-minute timestamp tolerance, and processes only `transaction_updated` events with `data.status === "completed"`.

The application correlates transactions to server-created `moonpay_{uuid}` order documents and checks the completed transaction’s destination wallet against `TREASURY_WALLET_ADDRESS`. Fulfillment is an Admin SDK transaction that marks the order completed and activates the user’s Pro subscription exactly once. No browser redirect or client-controlled metadata can grant access.
