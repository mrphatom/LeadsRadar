import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  isVerifiedPaystackTransaction,
  parsePaystackMetadata,
  verifyPaystackSignature,
} from '../src/server/payments.ts';

const secret = 'paystack-test-secret';
const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ref_123' } });

 test('verifies Paystack webhook signatures with timing-safe comparison', () => {
  const signature = crypto.createHmac('sha512', secret).update(body).digest('hex');
  assert.equal(verifyPaystackSignature(body, signature, secret), true);
  assert.equal(verifyPaystackSignature(body, `${signature.slice(0, -1)}0`, secret), false);
  assert.equal(verifyPaystackSignature(body, undefined, secret), false);
});

test('parses object and JSON-string Paystack metadata safely', () => {
  assert.deepEqual(parsePaystackMetadata({ uid: 'user-1', tier: 'pro' }), { uid: 'user-1', tier: 'pro' });
  assert.deepEqual(parsePaystackMetadata('{"uid":"user-1","tier":"pro"}'), { uid: 'user-1', tier: 'pro' });
  assert.deepEqual(parsePaystackMetadata('not-json'), {});
  assert.deepEqual(parsePaystackMetadata(undefined), {});
});

test('accepts only successful transactions owned by the authenticated principal', () => {
  const expected = { uid: 'user-1', email: 'owner@example.com', tier: 'pro' as const };
  const base = {
    status: 'success',
    reference: 'ref_123',
    customer: { email: 'owner@example.com' },
    metadata: { uid: 'user-1', tier: 'pro' },
  };

  assert.equal(isVerifiedPaystackTransaction(base, expected), true);
  assert.equal(isVerifiedPaystackTransaction({ ...base, status: 'failed' }, expected), false);
  assert.equal(isVerifiedPaystackTransaction({ ...base, customer: { email: 'other@example.com' } }, expected), false);
  assert.equal(isVerifiedPaystackTransaction({ ...base, metadata: { uid: 'other-user', tier: 'pro' } }, expected), false);
  assert.equal(isVerifiedPaystackTransaction({ ...base, metadata: { uid: 'user-1', tier: 'free' } }, expected), false);
});
