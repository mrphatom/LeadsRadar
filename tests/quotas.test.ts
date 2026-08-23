import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeDailySearchQuota } from '../src/server/quotas.ts';

function createFakeDb(subscriptionTier: 'free' | 'pro') {
  const documents = new Map<string, Record<string, unknown>>([
    ['users/user-1', { subscriptionTier }],
  ]);

  const refFor = (collection: string, id: string) => ({
    key: `${collection}/${id}`,
    get: async () => ({
      exists: documents.has(`${collection}/${id}`),
      data: () => documents.get(`${collection}/${id}`),
    }),
  });

  return {
    collection(collection: string) {
      return {
        doc(id: string) {
          return refFor(collection, id);
        },
      };
    },
    async runTransaction(callback: (transaction: any) => Promise<unknown>) {
      const writes: Array<{ key: string; data: Record<string, unknown> }> = [];
      const result = await callback({
        get: async (ref: ReturnType<typeof refFor>) => ref.get(),
        set: (ref: ReturnType<typeof refFor>, data: Record<string, unknown>) => writes.push({ key: ref.key, data }),
      });
      for (const write of writes) {
        documents.set(write.key, { ...(documents.get(write.key) || {}), ...write.data });
      }
      return result;
    },
  };
}

test('enforces the free daily search limit server-side', async () => {
  const db = createFakeDb('free');
  const now = new Date('2026-08-23T12:00:00.000Z');

  for (let i = 0; i < 10; i += 1) {
    const result = await consumeDailySearchQuota(db, 'user-1', now);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 9 - i);
  }

  const exhausted = await consumeDailySearchQuota(db, 'user-1', now);
  assert.equal(exhausted.allowed, false);
  assert.equal(exhausted.used, 10);
  assert.equal(exhausted.limit, 10);
});

test('uses the server-owned Pro tier limit', async () => {
  const db = createFakeDb('pro');
  const result = await consumeDailySearchQuota(db, 'user-1', new Date('2026-08-23T12:00:00.000Z'));

  assert.equal(result.allowed, true);
  assert.equal(result.tier, 'pro');
  assert.equal(result.limit, 20);
  assert.equal(result.remaining, 19);
});
