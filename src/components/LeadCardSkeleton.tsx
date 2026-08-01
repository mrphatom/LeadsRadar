import React from 'react';
import { Database, ShieldCheck, RefreshCw } from 'lucide-react';

export default function LeadCardSkeleton({ count = 3, message = 'Syncing cloud database and verifying offline listings...' }: { count?: number; message?: string }) {
  return (
    <div className="space-y-4 animate-fadeIn">
      {message && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl text-xs text-zinc-400">
          <div className="flex items-center gap-2 font-medium">
            <RefreshCw className="h-3.5 w-3.5 text-orange-400 animate-spin" />
            <span>{message}</span>
          </div>
          <span className="font-mono text-[10px] text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
            ENCRYPTED SYNC
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={`skeleton_${index}`}
            className="rounded-3xl border border-zinc-800/60 bg-zinc-900/30 p-5 flex flex-col justify-between relative overflow-hidden h-[240px]"
          >
            {/* Top Row: Skeleton avatar & title */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 animate-pulse shrink-0" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-zinc-800 rounded-md animate-pulse" />
                  <div className="h-3 w-20 bg-zinc-800/60 rounded-md animate-pulse" />
                </div>
              </div>
              <div className="h-6 w-16 rounded-full bg-zinc-800/70 animate-pulse" />
            </div>

            {/* Middle Row: Contact lines */}
            <div className="space-y-2.5 my-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-zinc-800/80 animate-pulse" />
                <div className="h-3 w-40 bg-zinc-800/60 rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-zinc-800/80 animate-pulse" />
                <div className="h-3 w-48 bg-zinc-800/60 rounded animate-pulse" />
              </div>
            </div>

            {/* Bottom Row: Footprint badge & Action button */}
            <div className="pt-3 border-t border-zinc-800/40 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-zinc-800/80 animate-pulse" />
                <div className="h-3 w-24 bg-zinc-800/60 rounded animate-pulse" />
              </div>
              <div className="h-7 w-20 rounded-lg bg-zinc-800/80 animate-pulse" />
            </div>

            {/* Subtle shimmering highlight bar */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-zinc-800/10 to-transparent animate-[shimmer_2s_infinite]" />
          </div>
        ))}
      </div>
    </div>
  );
}
