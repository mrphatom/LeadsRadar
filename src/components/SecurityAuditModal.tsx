import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Lock, Unlock, Clock, CheckCircle2, UserCheck, Eye } from 'lucide-react';
import type { GuestUsageState } from '../types';
import { getGuestAuditState, recordSecurityAuditLog } from '../services/guestAuditService';

interface SecurityAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAnonymous: boolean;
}

export default function SecurityAuditModal({
  isOpen,
  onClose,
  isAnonymous,
}: SecurityAuditModalProps) {
  const [state, setState] = useState<GuestUsageState>(getGuestAuditState());
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen) {
      const updated = recordSecurityAuditLog(
        isAnonymous ? 'VIEWED_ANONYMOUS_SESSION_USAGE' : 'VIEWED_AUTHENTICATED_SESSION_USAGE',
        'AUDITED',
      );
      setState({ ...updated, isGuest: isAnonymous });
    }
  }, [isAnonymous, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4" role="presentation">
      <div
        ref={dialogRef}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-activity-title"
        aria-describedby="session-activity-description"
        tabIndex={-1}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="session-activity-title" className="text-base font-bold text-white flex items-center gap-2">
                Session Activity & Usage
              </h2>
              <p id="session-activity-description" className="text-xs text-zinc-400">
                Review this browser’s local usage snapshot. Server authentication, quotas, and permissions remain authoritative.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close session activity panel"
            className="text-zinc-500 hover:text-zinc-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Close <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Guest Mode Status Banner */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {state.isGuest ? (
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Lock className="h-5 w-5" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Unlock className="h-5 w-5" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {state.isGuest ? 'Guest Mode (Rate-Limited)' : 'Authenticated Mode'}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      state.isGuest
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {state.isGuest ? 'LIMITED USE' : 'UNLOCKED'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {state.isGuest
                    ? 'Guest users have session limits for provider queries and lead persistence.'
                    : 'Authenticated users receive the server-configured provider-query and lead-save limits; abuse throttling remains active.'}
                </p>
              </div>
            </div>

            <span className="max-w-[15rem] text-right text-[11px] leading-relaxed text-zinc-500">
              {state.isGuest
                ? 'Anonymous Firebase sessions are limited and do not replace an account.'
                : 'Signed-in account. Server-side subscription and quota checks apply.'}
            </span>
          </div>

          {/* Usage Progress Meters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Search quota */}
            <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-orange-400" />
                  Provider Queries
                </span>
                <span className="font-mono text-zinc-400">
                  {state.isGuest ? `${state.searchesUsed} / ${state.maxSearches}` : 'Server-managed'}
                </span>
              </div>
              <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: state.isGuest
                      ? `${Math.min(100, (state.searchesUsed / state.maxSearches) * 100)}%`
                      : '100%',
                  }}
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                {state.isGuest
                  ? `${Math.max(0, state.maxSearches - state.searchesUsed)} scans remaining in guest session.`
                  : 'Authenticated mode uses the configured Google Places provider; request limits still apply.'}
              </p>
            </div>

            {/* Leads Saved quota */}
            <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-orange-400" />
                  Saved CRM Leads
                </span>
                <span className="font-mono text-zinc-400">
                  {state.isGuest ? `${state.leadsSaved} / ${state.maxLeadsSaved}` : 'Server-managed'}
                </span>
              </div>
              <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: state.isGuest
                      ? `${Math.min(100, (state.leadsSaved / state.maxLeadsSaved) * 100)}%`
                      : '100%',
                  }}
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                {state.isGuest
                  ? `${Math.max(0, state.maxLeadsSaved - state.leadsSaved)} lead saves remaining.`
                  : 'Authenticated mode uses server-managed lead limits.'}
              </p>
            </div>
          </div>

          {/* Live Security Audit Trail */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-zinc-500" />
              Local Session Activity ({state.auditLogs.length} events)
            </h3>
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-zinc-900">
              {state.auditLogs.map((log) => (
                <div key={log.id} className="p-3 flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-zinc-300">{log.action}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          log.status === 'ALLOWED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : log.status === 'RATE_LIMITED'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      Browser-local event • ID: {log.id}
                    </p>
                  </div>
                  <span className="text-[11px] text-zinc-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            This panel is browser-local telemetry, not a server security log or identity record.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-zinc-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Done & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
