import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ApiError,
  getBearerToken,
  isAllowedOrigin,
  redactForLog,
} from '../src/server/security.ts';
import { getRuntimeConfig } from '../src/server/runtimeConfig.ts';

test('accepts exactly one bearer token from the authorization header', () => {
  assert.equal(getBearerToken('Bearer firebase-id-token'), 'firebase-id-token');
  assert.equal(getBearerToken('bearer firebase-id-token'), 'firebase-id-token');
  assert.equal(getBearerToken(undefined), null);
  assert.equal(getBearerToken('Basic abc'), null);
  assert.equal(getBearerToken('Bearer one two'), null);
});

test('allows only explicitly configured origins', () => {
  assert.equal(isAllowedOrigin('https://app.example.com', ['https://app.example.com']), true);
  assert.equal(isAllowedOrigin('https://evil.example.com', ['https://app.example.com']), false);
  assert.equal(isAllowedOrigin(undefined, ['https://app.example.com']), true);
});

test('redacts secrets and direct identifiers from structured log values', () => {
  const result = redactForLog({
    uid: 'user-123',
    email: 'owner@example.com',
    token: 'secret-token',
    authorization: 'Bearer secret-token',
    nested: { accessToken: 'nested-secret', value: 'safe' },
  });

  assert.deepEqual(result, {
    uid: '[redacted]',
    email: '[redacted]',
    token: '[redacted]',
    authorization: '[redacted]',
    nested: { accessToken: '[redacted]', value: 'safe' },
  });
});

test('rejects insecure production configuration', () => {
  assert.throws(
    () => getRuntimeConfig({ NODE_ENV: 'production', APP_URL: 'https://app.example.com' }),
    /ENCRYPTION_KEY is required in production/,
  );

  assert.throws(
    () => getRuntimeConfig({
      NODE_ENV: 'production',
      APP_URL: 'http://app.example.com',
      ENCRYPTION_KEY: 'x'.repeat(32),
    }),
    /APP_URL must use HTTPS in production/,
  );
});

test('enables demo mode only outside production by default', () => {
  const development = getRuntimeConfig({ NODE_ENV: 'development', APP_URL: 'http://localhost:3000' });
  assert.equal(development.allowDemoMode, true);

  const production = getRuntimeConfig({
    NODE_ENV: 'production',
    APP_URL: 'https://app.example.com',
    ENCRYPTION_KEY: 'x'.repeat(32),
  });
  assert.equal(production.allowDemoMode, false);
});

test('creates stable public API errors without exposing internal details', () => {
  const error = new ApiError(422, 'VALIDATION_ERROR', 'Invalid request', 'internal detail');
  assert.equal(error.statusCode, 422);
  assert.equal(error.code, 'VALIDATION_ERROR');
  assert.equal(error.publicMessage, 'Invalid request');
  assert.equal(error.internalMessage, 'internal detail');
});

import { requireAuth } from '../src/server/http.ts';

test('rejects missing bearer tokens before calling the verifier', async () => {
  let verifierCalled = false;
  let responseBody: unknown;
  let responseStatus = 200;
  const middleware = requireAuth(async () => {
    verifierCalled = true;
    return { uid: 'user-123' } as never;
  });

  await middleware(
    { headers: {}, requestId: 'req-12345678' } as never,
    {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(body: unknown) {
        responseBody = body;
        return this;
      },
      setHeader() { return this; },
    } as never,
    () => undefined,
  );

  assert.equal(verifierCalled, false);
  assert.equal(responseStatus, 401);
  assert.deepEqual(responseBody, {
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required.',
      requestId: 'req-12345678',
    },
  });
});

test('derives the principal from verified claims and never trusts request uid', async () => {
  const request = {
    headers: { authorization: 'Bearer valid-token' },
    body: { uid: 'attacker-controlled-user' },
    requestId: 'req-12345678',
  } as never;
  const middleware = requireAuth(async (token) => {
    assert.equal(token, 'valid-token');
    return { uid: 'verified-user', email: 'verified@example.com', email_verified: true } as never;
  });

  await middleware(
    request,
    {
      status() { return this; },
      json() { return this; },
      setHeader() { return this; },
    } as never,
    () => undefined,
  );

  assert.deepEqual((request as { principal: unknown }).principal, {
    uid: 'verified-user',
    email: 'verified@example.com',
    emailVerified: true,
    claims: { uid: 'verified-user', email: 'verified@example.com', email_verified: true },
  });
});

test('exposes safe MoonPay defaults from runtime configuration', () => {
  const config = getRuntimeConfig({ NODE_ENV: 'development', APP_URL: 'http://localhost:3000' });
  assert.equal(config.moonpayEnvironment, 'sandbox');
  assert.equal(config.moonpayBaseCurrencyCode, 'usd');
  assert.equal(config.moonpayCurrencyCode, 'usdc');
  assert.equal(config.moonpayMonthlyAmount, '7');
  assert.equal(config.moonpayYearlyAmount, '64');
  assert.throws(
    () => getRuntimeConfig({ NODE_ENV: 'production', APP_URL: 'https://app.example.com', ENCRYPTION_KEY: 'x'.repeat(32), MOONPAY_ENVIRONMENT: 'sandbox' }),
    /MOONPAY_ENVIRONMENT must be production in production/,
  );
});

test('exposes Google Places configuration without enabling synthetic fallback', () => {
  const unavailable = getRuntimeConfig({ NODE_ENV: 'development', APP_URL: 'http://localhost:3000' });
  assert.equal(unavailable.googlePlacesApiKey, undefined);

  const configured = getRuntimeConfig({
    NODE_ENV: 'development',
    APP_URL: 'http://localhost:3000',
    GOOGLE_PLACES_API_KEY: 'server-only-test-key',
  });
  assert.equal(configured.googlePlacesApiKey, 'server-only-test-key');
});
