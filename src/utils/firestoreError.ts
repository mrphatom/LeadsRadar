import type { OperationType } from '../firebase';

export interface SafeFirestoreErrorContext {
  operationType: OperationType;
  path: string | null;
  errorCode?: string;
}

function readErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.length <= 128 ? code : undefined;
}

export function getSafeFirestoreErrorContext(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): SafeFirestoreErrorContext {
  return {
    operationType,
    path,
    errorCode: readErrorCode(error),
  };
}

export function createFirestoreUserError(): Error {
  return new Error('Unable to complete the requested workspace operation. Please retry.');
}
