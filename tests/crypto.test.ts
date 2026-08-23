import assert from 'node:assert/strict';
import test from 'node:test';
import { createEncryptionService } from '../src/server/crypto.ts';

test('encrypts and decrypts token material with authenticated encryption', () => {
  const service = createEncryptionService('x'.repeat(32));
  const encrypted = service.encrypt('gmail-access-token');
  assert.equal(service.decrypt(encrypted), 'gmail-access-token');
  assert.notEqual(encrypted, 'gmail-access-token');
});

test('rejects tampered encrypted token material', () => {
  const service = createEncryptionService('x'.repeat(32));
  const encrypted = service.encrypt('gmail-access-token');
  const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`;
  assert.throws(() => service.decrypt(tampered), /Unable to decrypt credential/);
});

test('requires a sufficiently long encryption key', () => {
  assert.throws(() => createEncryptionService(undefined), /ENCRYPTION_KEY is required/);
  assert.throws(() => createEncryptionService('too-short'), /ENCRYPTION_KEY must be at least 32 bytes/);
});
