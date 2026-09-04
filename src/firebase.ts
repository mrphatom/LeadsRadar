import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { configureAuthPersistence, type AuthPersistenceMode } from './authPersistence';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId || undefined);

export const auth = getAuth(app);
export const authPersistenceReady: Promise<AuthPersistenceMode> = configureAuthPersistence(
  setPersistence,
  auth,
  browserLocalPersistence,
);

import { createFirestoreUserError, getSafeFirestoreErrorContext } from './utils/firestoreError';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  console.error('Firestore operation failed:', getSafeFirestoreErrorContext(error, operationType, path));
  throw createFirestoreUserError();
}
