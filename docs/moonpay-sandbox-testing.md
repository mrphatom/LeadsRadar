# MoonPay sandbox testing

This guide tests the MoonPay migration without deploying the application, changing Firebase rules, or using production keys. MoonPay’s official quickstart states that sandbox mode is selected with `environment: "sandbox"` and warns that test cards must never be used with a production widget. See the [MoonPay sandbox quickstart](https://dev.moonpay.com/widget/on-ramp/quickstart) and [sandbox testing guide](https://dev.moonpay.com/widget/sandbox-testing).

## Local setup

Copy `.env.example` to a local, untracked `.env`, set `NODE_ENV=development`, keep `MOONPAY_ENVIRONMENT=sandbox`, and supply MoonPay sandbox publishable, URL-signing, and webhook keys. Set `TREASURY_WALLET_ADDRESS` to the wallet used for the sandbox transaction and keep the default `MOONPAY_CURRENCY_CODE=usdc` only if that asset and wallet network are enabled for the MoonPay account. Use a local Firebase Admin configuration suitable for development; never copy production credentials into the sandbox environment.

Start the application with `npm run dev`, sign in through Firebase, open the subscription modal, select a plan, and choose **Continue with MoonPay**. The browser calls the authenticated `/api/moonpay/sign-url` route. The server creates a pending `moonpay_{uuid}` order, signs the complete widget query string, and the browser opens the returned sandbox overlay. The browser must not call a provider API directly with the MoonPay secret key.

## Webhook verification

Configure the MoonPay sandbox dashboard to send transaction events to `https://YOUR_TEST_HOST/api/webhooks/moonpay`. For local testing, use an approved HTTPS development tunnel or a staging host; do not expose a local webhook endpoint by disabling signature verification. The application accepts the current `Moonpay-Signature-V2` header and validates HMAC-SHA256 over `<timestamp>.<raw request body>` with a five-minute timestamp tolerance before parsing the event.

Complete a sandbox transaction and confirm that the webhook event is `transaction_updated` with `data.status === "completed"`. The event must contain the server-created `externalTransactionId` and the destination wallet must match `TREASURY_WALLET_ADDRESS`. A valid event marks `moonpayOrders/{orderId}` completed and activates Pro in the associated user profile. Replaying the same valid event must return an idempotent result and must not extend or duplicate the subscription unexpectedly.

## Automated checks

Run the deterministic provider tests and the complete local gates:

```bash
npm ci --ignore-scripts
npm run lint
npm test
npm run build
npm run audit
git diff --check
```

The unit tests in `tests/moonpay.test.ts` cover the official URL-signing vector, strict order correlation, invalid signatures, and stale webhook timestamps. `tests/moonpayFulfillment.test.ts` covers treasury-wallet matching and idempotent fulfillment. No automated check in this repository contacts MoonPay, Firebase production, or a live payment account.

## Failure expectations

A missing or invalid MoonPay configuration returns a structured dependency error in development and fails startup in production. A missing Firebase bearer token is rejected before the signing route runs. A malformed, stale, or invalidly signed webhook is rejected without changing Firestore. A valid transaction sent to another wallet, an unknown order, a customer identifier used in place of an order identifier, or a non-completed status is acknowledged without subscription fulfillment.
