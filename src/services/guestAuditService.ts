import type { GuestUsageState } from '../types';

const STORAGE_KEY = 'leadsradar_guest_session_v1';
const LEGACY_STORAGE_KEY = 'ai_studio_guest_audit_state_v1';
const MAX_LOGS = 50;

const DEFAULT_STATE: GuestUsageState = {
  isGuest: true,
  searchesUsed: 0,
  maxSearches: 5,
  leadsSaved: 0,
  maxLeadsSaved: 10,
  auditLogs: [],
};

function clampCount(value: unknown, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(0, Math.floor(value)))
    : 0;
}

function normalizeState(value: unknown): GuestUsageState {
  if (!value || typeof value !== 'object') return { ...DEFAULT_STATE };
  const candidate = value as Partial<GuestUsageState>;
  const auditLogs: GuestUsageState['auditLogs'] = Array.isArray(candidate.auditLogs)
    ? candidate.auditLogs
      .filter((entry): entry is GuestUsageState['auditLogs'][number] => Boolean(entry) && typeof entry === 'object')
      .slice(0, MAX_LOGS)
      .map((entry) => ({
        id: typeof entry.id === 'string' ? entry.id.slice(0, 80) : `local_${Date.now()}`,
        action: typeof entry.action === 'string' ? entry.action.slice(0, 120) : 'LOCAL_SESSION_EVENT',
        timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : new Date().toISOString(),
        scope: 'browser-local',
        status: entry.status === 'RATE_LIMITED' || entry.status === 'AUDITED' ? entry.status : 'ALLOWED',
      }))
    : [];

  return {
    isGuest: candidate.isGuest !== false,
    searchesUsed: clampCount(candidate.searchesUsed, 5),
    maxSearches: 5,
    leadsSaved: clampCount(candidate.leadsSaved, 10),
    maxLeadsSaved: 10,
    auditLogs,
  };
}

function readStoredState(): GuestUsageState | null {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const legacy = current ? null : localStorage.getItem(LEGACY_STORAGE_KEY);
    return current || legacy ? normalizeState(JSON.parse(current || legacy || '')) : null;
  } catch {
    return null;
  }
}

export function getGuestAuditState(): GuestUsageState {
  const stored = readStoredState();
  const state = stored || { ...DEFAULT_STATE };
  if (!stored) saveGuestAuditState(state);
  return state;
}

export function saveGuestAuditState(state: GuestUsageState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Browser-local telemetry is optional and must never block the workspace.
  }
}

export function recordSecurityAuditLog(
  action: string,
  status: 'ALLOWED' | 'RATE_LIMITED' | 'AUDITED' = 'ALLOWED'
): GuestUsageState {
  const current = getGuestAuditState();
  const newLog: GuestUsageState['auditLogs'][number] = {
    id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    action: action.slice(0, 120),
    timestamp: new Date().toISOString(),
    scope: 'browser-local',
    status,
  };

  const updatedState: GuestUsageState = {
    ...current,
    auditLogs: [newLog, ...current.auditLogs].slice(0, MAX_LOGS),
  };

  saveGuestAuditState(updatedState);
  return updatedState;
}

export function checkGuestSearchLimit(): { allowed: boolean; remaining: number; state: GuestUsageState } {
  const state = getGuestAuditState();
  if (!state.isGuest) {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY, state };
  }

  if (state.searchesUsed >= state.maxSearches) {
    const updated = recordSecurityAuditLog('GUEST_SEARCH_LIMIT_REACHED', 'RATE_LIMITED');
    return { allowed: false, remaining: 0, state: updated };
  }

  const updated: GuestUsageState = {
    ...state,
    searchesUsed: state.searchesUsed + 1,
  };
  saveGuestAuditState(updated);
  recordSecurityAuditLog(`GUEST_SEARCH_STARTED (${updated.searchesUsed}/${updated.maxSearches})`, 'ALLOWED');
  return { allowed: true, remaining: updated.maxSearches - updated.searchesUsed, state: updated };
}

export function checkGuestSaveLimit(): { allowed: boolean; remaining: number; state: GuestUsageState } {
  const state = getGuestAuditState();
  if (!state.isGuest) {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY, state };
  }

  if (state.leadsSaved >= state.maxLeadsSaved) {
    const updated = recordSecurityAuditLog('GUEST_LEAD_SAVE_LIMIT_REACHED', 'RATE_LIMITED');
    return { allowed: false, remaining: 0, state: updated };
  }

  const updated: GuestUsageState = {
    ...state,
    leadsSaved: state.leadsSaved + 1,
  };
  saveGuestAuditState(updated);
  recordSecurityAuditLog(`GUEST_LEAD_SAVE_STARTED (${updated.leadsSaved}/${updated.maxLeadsSaved})`, 'ALLOWED');
  return { allowed: true, remaining: updated.maxLeadsSaved - updated.leadsSaved, state: updated };
}

export function setGuestSession(isGuest: boolean): GuestUsageState {
  const updated: GuestUsageState = {
    ...getGuestAuditState(),
    isGuest,
  };
  saveGuestAuditState(updated);
  return recordSecurityAuditLog(isGuest ? 'ANONYMOUS_SESSION_ACTIVE' : 'AUTHENTICATED_SESSION_ACTIVE', 'AUDITED');
}
