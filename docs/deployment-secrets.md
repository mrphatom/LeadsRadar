# LeadsRadar Deployment Secrets

This document lists the configuration required to deploy LeadsRadar. **Secret values must be entered directly into the deployment provider's secret manager or environment settings. Do not paste them into GitHub, source files, screenshots, issue trackers, chat, or build logs.** The repository contains only the variable names and non-secret defaults.

## Runtime baseline

Use **Node.js 22 or newer**. Firebase Admin SDK 14 requires Node.js 22+, and the repository pins the expected major runtime in `.nvmrc`. Install with `npm ci --ignore-scripts`, build with `npm run build`, and start with `npm run start`.

## Required production configuration

| Variable | Secret? | Required when | How to obtain or choose it |
|---|---:|---|---|
| `NODE_ENV` | No | Always | Set to `production`. This enables fail-closed production checks. |
| `APP_URL` | No | Always | Set to the final HTTPS origin, for example `https://app.example.com`. It is also used for MoonPay completion redirects. |
| `ALLOWED_ORIGINS` | No | Recommended | Comma-separated list of trusted browser origins. Include the exact production origin and do not use `*`. |
| `PORT` | No | Optional | Use the port supplied by the hosting provider, or allow the default `3000`. |
| `GOOGLE_PLACES_API_KEY` | Yes | Lead discovery/enrichment | In Google Cloud, create or select a project, enable **Places API (New)**, attach billing, create an API key, and restrict it to the Places API. For a server-side key, use the hosting provider's stable egress IP restriction when available; otherwise use the narrowest supported restriction and monitor usage. The key is server-only and must never be exposed to the browser. See [Set up Places API (New)](https://developers.google.com/maps/documentation/places/web-service/get-api-key) and [Google Maps Platform API security](https://developers.google.com/maps/api-security-best-practices). |
| `FIREBASE_SERVICE_ACCOUNT` | Yes | Non-Google hosting or any deployment not using Application Default Credentials | In Firebase Console, open **Project settings → Service accounts → Firebase Admin SDK → Generate new private key**. Store the downloaded JSON as one-line JSON in the deployment secret named `FIREBASE_SERVICE_ACCOUNT`. Do not commit the downloaded file. Firebase documents Application Default Credentials as the preferred option for Google-managed runtimes; if the hosting platform supplies ADC, this variable may be omitted. See [Add the Firebase Admin SDK to your server](https://firebase.google.com/docs/admin/setup). |
| `ENCRYPTION_KEY` | Yes | Always in production | Generate a new random value with `openssl rand -base64 32` or another approved secret generator. The application requires at least 32 UTF-8 bytes. Keep the value stable: changing it without a planned Gmail-token re-encryption migration makes existing encrypted Gmail tokens unreadable. |

## Optional production configuration

| Variable | Secret? | Purpose and instructions |
|---|---:|---|
| `GEMINI_API_KEY` | Yes | Optional generated guidance only. Create an authentication key in [Google AI Studio API Keys](https://aistudio.google.com/apikey), restrict it to the Gemini API, and store it server-side. It must not be used as evidence for lead identity, contact details, reviews, rankings, traffic, revenue, or competitor claims. Google’s current guidance recommends environment variables or Secret Manager and warns against client-side exposure. |
| `JSON_BODY_LIMIT` | No | Optional Express request-body limit; default is `256kb`. Keep it bounded unless a documented endpoint requires more. |

## MoonPay billing configuration

MoonPay requires an approved account and separate sandbox/live credentials. Use sandbox credentials for local testing and live credentials only for the production deployment. Test and live keys are environment-specific and must not be mixed.

| Variable | Secret? | How to obtain or choose it |
|---|---:|---|
| `MOONPAY_ENVIRONMENT` | No | Set to `production` in production. Use `sandbox` only for local testing. |
| `MOONPAY_PUBLISHABLE_KEY` | Sensitive, client-visible through signed widget URL | In the [MoonPay Dashboard Developers → API keys](https://dashboard.moonpay.com/developers/api-keys), obtain the matching `pk_live_...` key for production or `pk_test_...` for sandbox. The application sends it as the widget's `apiKey`; do not substitute the secret key. |
| `MOONPAY_SECRET_KEY` | Yes | Obtain the matching `sk_live_...` or `sk_test_...` key from the MoonPay API keys page. Keep it server-side; it signs widget URLs and must never be sent to the browser. See [MoonPay API authentication](https://dev.moonpay.com/api-reference/widget/using-the-api). |
| `MOONPAY_WEBHOOK_SECRET` | Yes | In the MoonPay Dashboard Developers/Webhooks area, retrieve the webhook API key used for `Moonpay-Signature-V2` verification. Configure the webhook endpoint as `https://YOUR_DOMAIN/api/webhooks/moonpay` and subscribe to the transaction event required by the application. See [MoonPay webhook setup](https://dev.moonpay.com/api-reference/widget/webhooks/overview) and [webhook request signing](https://dev.moonpay.com/api-reference/widget/webhooks/signature). |
| `TREASURY_WALLET_ADDRESS` | Sensitive operational value | Set the exact destination wallet configured for the MoonPay on-ramp and selected asset/network. The webhook fulfillment path checks this value before activating a subscription. Verify the address independently before enabling live billing. |
| `MOONPAY_BASE_CURRENCY_CODE` | No | Optional fiat code; default is `usd`. |
| `MOONPAY_CURRENCY_CODE` | No | Optional crypto asset code; default is `usdc`. Confirm the asset and network are enabled for the MoonPay account and treasury wallet. |
| `MOONPAY_MONTHLY_AMOUNT` | No | Optional locked fiat plan amount; default is `7`. |
| `MOONPAY_YEARLY_AMOUNT` | No | Optional locked fiat plan amount; default is `64`. |

## Firebase browser configuration

`firebase-applet-config.json` is used by the browser client and contains Firebase project configuration rather than an Admin private key. Confirm that it points to the intended Firebase project and named Firestore database. Enable the authentication providers used by the product and create the Firestore database before deployment. Deploying application code does not deploy Firebase rules automatically; rules deployment is a separate, explicitly reviewed operation.

## Container deployment

The repository includes a multi-stage `Dockerfile` based on Node 22. It installs locked dependencies, builds the client and server in a build stage, and copies only production dependencies and build artifacts into the runtime image. The image runs as the non-root `node` user and does not receive secrets at build time.

```bash
docker build --tag leadsradar:release .
docker run --rm -p 3000:3000 \
  --env-file /secure/path/leadsradar-production.env \
  leadsradar:release
```

For a managed container platform, configure the image health checks as `GET /healthz` for liveness and `GET /readyz` for readiness. The readiness probe returns `503` until Firebase Admin Auth and Firestore initialize. Do not bake the environment file into the image; use the platform secret store instead.

## Recommended secret-manager procedure

Create separate secret sets for local development, staging, and production. Use the hosting provider's encrypted environment-variable store or Google Cloud Secret Manager. Grant the deployed server identity only the minimum access required to read the secrets. Inject secrets at runtime rather than writing a `.env` file into the image or repository.

For a first deployment, configure the non-secret runtime variables, then add Firebase credentials and `ENCRYPTION_KEY`, then add Google Places if discovery is required, and finally configure MoonPay only after the application is reachable over HTTPS. Keep MoonPay in sandbox until a complete end-to-end transaction and webhook test has passed.

After setting variables, run the following from a clean checkout:

```bash
node --version
npm ci --ignore-scripts
npm run lint
npm test
npm run test:rules
npm run build
npm run audit
```

Start the built server only through the hosting provider's secret-injected process. Verify `/healthz` returns `200`, `/readyz` returns `200` only when Firebase Admin initialized, and `/api/config` exposes availability flags but never returns secret values. Verify that protected routes reject missing Firebase bearer tokens, that discovery returns unavailable rather than synthetic data when Google Places is absent, and that MoonPay webhook verification rejects unsigned or stale requests.

## Rotation and incident response

If a secret may have been exposed, create a replacement in the provider dashboard, deploy the replacement, verify service health, and then disable the old credential. Do not print the old or new value during diagnosis. Rotate `ENCRYPTION_KEY` only through a planned data migration because existing encrypted Gmail tokens depend on it. Treat a service-account JSON file, MoonPay secret, Google Places key, Gemini key, and webhook key as credentials even when a provider describes one as publishable.
