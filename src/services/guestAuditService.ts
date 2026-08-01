import { GuestUsageState } from '../types';

const STORAGE_KEY = 'ai_studio_guest_audit_state_v1';

const DEFAULT_STATE: GuestUsageState = {
  isGuest: true,
  searchesUsed: 0,
  maxSearches: 5,
  leadsSaved: 0,
  maxLeadsSaved: 10,
  auditLogs: [
    {
      id: 'audit_init',
      action: 'SYSTEM_SESSION_INITIALIZED',
      timestamp: new Date().toISOString(),
      ipHash: 'session-anon-guest-84f9a',
      status: 'ALLOWED',
    },
  ],
};

export function getGuestAuditState(): GuestUsageState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATE));
      return DEFAULT_STATE;
    }
    const parsed = JSON.parse(raw) as GuestUsageState;
    return parsed;
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveGuestAuditState(state: GuestUsageState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save guest audit state:', err);
  }
}

export function recordSecurityAuditLog(
  action: string,
  status: 'ALLOWED' | 'RATE_LIMITED' | 'AUDITED' = 'ALLOWED'
): GuestUsageState {
  const current = getGuestAuditState();
  const newLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    action,
    timestamp: new Date().toISOString(),
    ipHash: current.isGuest ? 'session-anon-guest' : 'session-authenticated-user',
    status,
  };

  const updatedState: GuestUsageState = {
    ...current,
    auditLogs: [newLog, ...current.auditLogs].slice(0, 50),
  };

  saveGuestAuditState(updatedState);
  return updatedState;
}

export function checkGuestSearchLimit(): { allowed: boolean; remaining: number; state: GuestUsageState } {
  const state = getGuestAuditState();
  if (!state.isGuest) {
    recordSecurityAuditLog('SEARCH_EXECUTION_AUTHENTICATED', 'ALLOWED');
    return { allowed: true, remaining: 999, state };
  }

  if (state.searchesUsed >= state.maxSearches) {
    const updated = recordSecurityAuditLog('SEARCH_EXECUTION_GUEST_LIMIT_REACHED', 'RATE_LIMITED');
    return { allowed: false, remaining: 0, state: updated };
  }

  const updated: GuestUsageState = {
    ...state,
    searchesUsed: state.searchesUsed + 1,
  };
  saveGuestAuditState(updated);
  recordSecurityAuditLog(`SEARCH_EXECUTION_GUEST (${updated.searchesUsed}/${updated.maxSearches})`, 'ALLOWED');
  return { allowed: true, remaining: updated.maxSearches - updated.searchesUsed, state: updated };
}

export function checkGuestSaveLimit(): { allowed: boolean; remaining: number; state: GuestUsageState } {
  const state = getGuestAuditState();
  if (!state.isGuest) {
    recordSecurityAuditLog('LEAD_SAVE_AUTHENTICATED', 'ALLOWED');
    return { allowed: true, remaining: 999, state };
  }

  if (state.leadsSaved >= state.maxLeadsSaved) {
    const updated = recordSecurityAuditLog('LEAD_SAVE_GUEST_LIMIT_REACHED', 'RATE_LIMITED');
    return { allowed: false, remaining: 0, state: updated };
  }

  const updated: GuestUsageState = {
    ...state,
    leadsSaved: state.leadsSaved + 1,
  };
  saveGuestAuditState(updated);
  recordSecurityAuditLog(`LEAD_SAVE_GUEST (${updated.leadsSaved}/${updated.maxLeadsSaved})`, 'ALLOWED');
  return { allowed: true, remaining: updated.maxLeadsSaved - updated.leadsSaved, state: updated };
}

export function toggleGuestMode(isGuest: boolean): GuestUsageState {
  const state = getGuestAuditState();
  const updated: GuestUsageState = {
    ...state,
    isGuest,
  };
  saveGuestAuditState(updated);
  recordSecurityAuditLog(
    isGuest ? 'USER_SWITCHED_TO_GUEST_MODE' : 'USER_AUTHENTICATED_UNLIMITED_ACCESS',
    'AUDITED'
  );
  return updated;
}
