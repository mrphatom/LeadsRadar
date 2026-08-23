import crypto from 'node:crypto';

const VERSION = 'v1';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export interface EncryptionService {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

export function createEncryptionService(secret: string | undefined): EncryptionService {
  if (!secret) {
    throw new Error('ENCRYPTION_KEY is required.');
  }
  if (Buffer.byteLength(secret, 'utf8') < KEY_LENGTH) {
    throw new Error('ENCRYPTION_KEY must be at least 32 bytes.');
  }

  const key = crypto.createHash('sha256').update(secret, 'utf8').digest();

  return {
    encrypt(plaintext: string): string {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
    },

    decrypt(ciphertext: string): string {
      try {
        const [version, ivValue, tagValue, encryptedValue] = ciphertext.split('.');
        if (version !== VERSION || !ivValue || !tagValue || !encryptedValue) {
          throw new Error('Malformed encrypted value.');
        }
        const iv = Buffer.from(ivValue, 'base64url');
        const tag = Buffer.from(tagValue, 'base64url');
        const encrypted = Buffer.from(encryptedValue, 'base64url');
        if (iv.length !== IV_LENGTH || tag.length !== 16 || encrypted.length === 0) {
          throw new Error('Malformed encrypted value.');
        }
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
      } catch {
        throw new Error('Unable to decrypt credential.');
      }
    },
  };
}
