export type AuthPersistenceMode = 'local' | 'memory';

export async function configureAuthPersistence<TAuth, TPersistence>(
  setPersistence: (auth: TAuth, persistence: TPersistence) => Promise<unknown>,
  auth: TAuth,
  persistence: TPersistence,
): Promise<AuthPersistenceMode> {
  try {
    await setPersistence(auth, persistence);
    return 'local';
  } catch {
    // Firebase can still authenticate with in-memory persistence in restricted
    // browser contexts, but the UI must not imply that a session will survive
    // a reload when local storage is unavailable.
    return 'memory';
  }
}
