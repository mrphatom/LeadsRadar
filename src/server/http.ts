import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { ZodType } from 'zod';
import {
  ApiError,
  createRequestId,
  getBearerToken,
  redactForLog,
} from './security.ts';
import { isProSubscriptionActive } from './subscription.ts';

export { isProSubscriptionActive } from './subscription.ts';

export interface Principal {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  claims: DecodedIdToken;
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      principal?: Principal;
      rawBody?: Buffer;
    }
  }
}

export const requestContext: RequestHandler = (req, res, next) => {
  const requestId = createRequestId(req.headers['x-request-id']);
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};

export function requireAuth(
  verifyIdToken: (idToken: string) => Promise<DecodedIdToken>,
): RequestHandler {
  return async (req, res, next) => {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      return sendApiError(res, req, new ApiError(401, 'UNAUTHORIZED', 'Authentication required.'));
    }

    try {
      const claims = await verifyIdToken(token);
      if (!claims.uid || typeof claims.uid !== 'string') {
        throw new ApiError(401, 'UNAUTHORIZED', 'Invalid authentication token.');
      }
      req.principal = {
        uid: claims.uid,
        email: typeof claims.email === 'string' ? claims.email : undefined,
        emailVerified: claims.email_verified === true,
        claims,
      };
      return next();
    } catch (error) {
      if (error instanceof ApiError) {
        return sendApiError(res, req, error);
      }
      return sendApiError(res, req, new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired authentication token.'));
    }
  };
}

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return sendApiError(res, req, new ApiError(422, 'VALIDATION_ERROR', 'Request body is invalid.', result.error.message));
    }
    req.body = result.data;
    next();
  };
}

export function requirePro(getDb: () => any): RequestHandler {
  return async (req, res, next) => {
    const principal = req.principal;
    if (!principal) {
      return sendApiError(res, req, new ApiError(401, 'UNAUTHORIZED', 'Authentication required.'));
    }
    const db = getDb();
    if (!db) {
      return sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Subscription service is temporarily unavailable.'));
    }

    try {
      const userSnapshot = await db.collection('users').doc(principal.uid).get();
      if (!isProSubscriptionActive(userSnapshot.data())) {
        return sendApiError(res, req, new ApiError(403, 'FORBIDDEN', 'A Pro subscription is required for this feature.'));
      }
      next();
    } catch (error) {
      logEvent('error', 'subscription_authorization_failed', req, { errorName: error instanceof Error ? error.name : 'UnknownError' });
      sendApiError(res, req, new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'Subscription service is temporarily unavailable.'));
    }
  };
}

export function requirePrincipal(req: Request): Principal {
  if (!req.principal) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  }
  return req.principal;
}

export function sendApiError(res: Response, req: Request, error: unknown): void {
  const apiError = error instanceof ApiError
    ? error
    : new ApiError(500, 'INTERNAL_ERROR', 'An unexpected server error occurred.', error instanceof Error ? error.message : String(error));

  if (!(error instanceof ApiError)) {
    logEvent('error', 'api_request_failed', req, {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: apiError.internalMessage,
    });
  }

  res.status(apiError.statusCode).json({
    error: {
      code: apiError.code,
      message: apiError.publicMessage,
      requestId: req.requestId,
    },
  });
}

export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
  sendApiError(res, req, error);
};

export function logEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  req: Request | undefined,
  fields: Record<string, unknown> = {},
): void {
  const entry = redactForLog({
    timestamp: new Date().toISOString(),
    level,
    event,
    requestId: req?.requestId,
    ...fields,
  });
  const line = JSON.stringify(entry);
  console[level](line);
}
