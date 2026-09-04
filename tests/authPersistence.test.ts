import test from 'node:test';
import assert from 'node:assert/strict';
import { configureAuthPersistence } from '../src/authPersistence';

test('configures local persistence before auth operations', async () => {
  const calls: unknown[] = [];
  const auth = { name: 'auth' };
  const persistence = { name: 'browserLocalPersistence' };

  const mode = await configureAuthPersistence(
    async (authInstance, persistenceInstance) => {
      calls.push(authInstance, persistenceInstance);
    },
    auth,
    persistence,
  );

  assert.equal(mode, 'local');
  assert.deepEqual(calls, [auth, persistence]);
});

test('reports memory mode when browser persistence cannot be initialized', async () => {
  const mode = await configureAuthPersistence(
    async () => {
      throw new Error('indexeddb unavailable');
    },
    {},
    {},
  );

  assert.equal(mode, 'memory');
});
