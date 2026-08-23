import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  ApiError,
  createRequestId,
  getBearerToken,
  redactForLog,
} from './security.ts';

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
