import assert from 'node:assert/strict';
import test from 'node:test';
import { fulfillMoonPaySubscription } from '../src/server/moonpayFulfillment.ts';

function createFakeDb() {
  const documents = new Map<string, Record<string, unknown>>([
    ['moonpayOrders/order-1', { uid: 'user-1', period: 'month', status: 'pending', provider: 'moonpay' }],
    ['users/user-1', { subscriptionTier: 'free' }],
  ]);
  const refFor = (collection: string, id: string) => ({
    key: `${collection}/${id}`,
  });
  return {
    collection(collection: string) {
      return { doc: (id: string) => refFor(collection, id) };
    },
    async runTransaction(callback: (transaction: any) => Promise<unknown>) {
      const writes: Array<{ key: string; data: Record<string, unknown> }> = [];
      const result = await callback({
        get: async (ref: ReturnType<typeof refFor>) => ({
          exists: documents.has(ref.key),
          data: () => documents.get(ref.key),
        }),
        set: (ref: ReturnType<typeof refFor>, data: Record<string, unknown>) => writes.push({ key: ref.key, data }),
      });
      for (const write of writes) documents.set(write.key, { ...(documents.get(write.key) || {}), ...write.data });
      return result;
    },
    read(key: string) {
      return documents.get(key);
    },
  };
}

test('fulfills a completed MoonPay order once for the configured treasury wallet', async () => {
  const db = createFakeDb();
  const now = new Date('2026-08-23T12:00:00.000Z');
  const transaction = { id: 'mp_tx_1', status: 'completed', walletAddress: '0xTREASURY' };

  assert.equal(await fulfillMoonPaySubscription(db, 'order-1', transaction, '0xtreasury', now), 'fulfilled');
  assert.equal(db.read('users/user-1')?.subscriptionTier, 'pro');
  assert.equal(db.read('users/user-1')?.subscriptionSource, 'moonpay');
  assert.equal(db.read('moonpayOrders/order-1')?.providerTransactionId, 'mp_tx_1');
  assert.equal(await fulfillMoonPaySubscription(db, 'order-1', transaction, '0xtreasury', now), 'already_fulfilled');
});

test('ignores completed transactions sent to another wallet', async () => {
  const db = createFakeDb();
  const result = await fulfillMoonPaySubscription(
    db,
    'order-1',
    { id: 'mp_tx_2', status: 'completed', walletAddress: '0xOTHER' },
    '0xTREASURY',
  );

  assert.equal(result, 'ignored');
  assert.equal(db.read('users/user-1')?.subscriptionTier, 'free');
});
