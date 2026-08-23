import crypto from 'node:crypto';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'PAYMENT_REQUIRED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly publicMessage: string;
  public readonly internalMessage: string;

  constructor(
    statusCode: number,
    code: ApiErrorCode,
    publicMessage: string,
    internalMessage = publicMessage,
  ) {
    super(publicMessage);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.publicMessage = publicMessage;
    this.internalMessage = internalMessage;
  }
}

export function getBearerToken(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer ([^\s]+)$/i);
  return match?.[1] ?? null;
}

export function isAllowedOrigin(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

const SENSITIVE_KEY = /(token|secret|password|authorization|cookie|api[-_]?key|email|uid|user[-_]?id)/i;

export function redactForLog(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item));
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redactForLog(item);
    }
    return output;
  }

  return value;
}

export function createRequestId(candidate?: string | string[]): string {
  if (typeof candidate === 'string' && /^[A-Za-z0-9._-]{8,128}$/.test(candidate)) {
    return candidate;
  }
  return crypto.randomUUID();
}
