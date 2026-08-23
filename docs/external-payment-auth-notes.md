# External implementation notes

## Firebase ID-token verification

Source: https://firebase.google.com/docs/auth/admin/verify-id-tokens

Firebase’s official guidance says a client should send its ID token to a custom backend over HTTPS; the backend must verify the token’s integrity and authenticity, then use the UID from the verified token to identify the user. The Admin SDK `verifyIdToken()` checks token format, expiry, and signature. Firebase documents that ordinary verification does not check token revocation; this migration uses the Admin SDK’s revocation-check option for protected API requests. The documented token claims include the Firebase project audience and secure-token issuer.

## Paystack payment verification

Source: https://paystack.com/docs/payments/verify-payments/

Paystack’s official guidance says the Verify Transaction API is called from the server using the transaction reference. The transaction status is `response.data.status`, not the HTTP/API response status. Successful value delivery must be idempotent so a transaction is not fulfilled twice.

## Paystack webhooks

Source: https://paystack.com/docs/payments/webhooks/

Paystack recommends webhooks for providing value rather than relying only on customer callbacks. Webhook requests include an `x-paystack-signature` header containing an HMAC-SHA512 signature over the event payload using the Paystack secret key. The signature should be validated before processing. A webhook should acknowledge with HTTP 200 promptly, and fulfillment should be idempotent because webhook events can be retried.
