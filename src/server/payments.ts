import crypto from 'node:crypto';

export interface PaystackPrincipal {
  uid: string;
  email?: string;
  tier: 'pro';
}

export interface PaystackTransactionLike {
  status?: unknown;
  reference?: unknown;
  customer?: { email?: unknown };
  metadata?: unknown;
}

export function verifyPaystackSignature(rawBody: string | Buffer, signature: string | undefined, secret: string | undefined): boolean {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const provided = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return provided.length === expectedBuffer.length && crypto.timingSafeEqual(provided, expectedBuffer);
}

export function parsePaystackMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function isVerifiedPaystackTransaction(
  transaction: PaystackTransactionLike,
  principal: PaystackPrincipal,
): boolean {
  if (transaction.status !== 'success') return false;
  const metadata = parsePaystackMetadata(transaction.metadata);
  if (metadata.uid !== principal.uid || metadata.tier !== principal.tier) return false;
  if (typeof transaction.reference !== 'string' || transaction.reference.length === 0) return false;
  if (!principal.email || typeof transaction.customer?.email !== 'string') return false;
  return transaction.customer.email.toLowerCase() === principal.email.toLowerCase();
}
