import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  buildMoonPayWidgetUrl,
  extractMoonPayOrderId,
  signMoonPayUrl,
  verifyMoonPayWebhookSignature,
} from '../src/server/moonpay.ts';

test('builds a sandbox checkout URL with locked plan and treasury parameters', () => {
  const url = buildMoonPayWidgetUrl({
    environment: 'sandbox',
    publishableKey: 'pk_test_key',
    baseCurrencyCode: 'usd',
    currencyCode: 'usdc',
    baseCurrencyAmount: '7',
    walletAddress: '0xTreasury',
    externalTransactionId: 'moonpay_123e4567-e89b-12d3-a456-426614174000',
    redirectUrl: 'http://localhost:3000/',
  });

  assert.equal(url.origin, 'https://buy-sandbox.moonpay.com');
  assert.equal(url.searchParams.get('apiKey'), 'pk_test_key');
  assert.equal(url.searchParams.get('currencyCode'), 'usdc');
  assert.equal(url.searchParams.get('walletAddress'), '0xTreasury');
  assert.equal(url.searchParams.get('lockAmount'), 'true');
  assert.equal(url.searchParams.get('externalTransactionId'), 'moonpay_123e4567-e89b-12d3-a456-426614174000');
});

test('signs a MoonPay URL using the full query string and base64 HMAC', () => {
  const url = new URL('https://buy-sandbox.moonpay.com/?apiKey=pk_test_DocsVector00&currencyCode=eth&walletAddress=0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe');
  const signed = signMoonPayUrl(url, 'sk_test_DocsVector00');
  const expectedSignature = 'oIJxSghyzll/BLhUFdQZhkxf7DAS8REFaWr/ibO+K8Q=';

  assert.equal(signed.searchParams.get('signature'), expectedSignature);
  assert.equal(signed.search, `${url.search}&signature=${encodeURIComponent(expectedSignature)}`);
});

test('accepts only server-created MoonPay order IDs for webhook correlation', () => {
  assert.equal(extractMoonPayOrderId({ externalTransactionId: 'moonpay_123e4567-e89b-12d3-a456-426614174000' }), 'moonpay_123e4567-e89b-12d3-a456-426614174000');
  assert.equal(extractMoonPayOrderId({ externalTransactionId: 'customer-123' }), null);
  assert.equal(extractMoonPayOrderId({ externalCustomerId: 'moonpay_123e4567-e89b-12d3-a456-426614174000' }), null);
});

test('rejects invalid and replayed MoonPay webhook signatures', () => {
  const body = JSON.stringify({ type: 'transaction_updated', data: { status: 'completed' } });
  const timestamp = 1_700_000_000;
  const secret = 'moonpay-webhook-test-secret';
  const digest = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const header = `t=${timestamp},s=${digest}`;

  assert.equal(verifyMoonPayWebhookSignature(body, header, secret, timestamp, 300), true);
  assert.equal(verifyMoonPayWebhookSignature(body, header, 'wrong-secret', timestamp, 300), false);
  assert.equal(verifyMoonPayWebhookSignature(body, header, secret, timestamp + 301, 300), false);
  assert.equal(verifyMoonPayWebhookSignature(body, `t=${timestamp},s=${digest.slice(0, -1)}0`, secret, timestamp, 300), false);
});
