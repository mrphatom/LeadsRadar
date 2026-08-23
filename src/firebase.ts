import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

import { createFirestoreUserError, getSafeFirestoreErrorContext } from './utils/firestoreError';

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  console.error('Firestore operation failed:', getSafeFirestoreErrorContext(error, operationType, path));
  throw createFirestoreUserError();
}
