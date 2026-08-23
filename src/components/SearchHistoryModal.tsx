import React, { useState } from 'react';
import { 
  History, Calendar, Clock, RefreshCw, Search, X, 
  MapPin, Building2, Globe, Layers, Sparkles, ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { CountryType } from '../types';

export interface SearchHistoryItem {
  id?: string;
  country: CountryType;
  city: string;
  category: string;
  platforms?: string[];
  timestamp: string;
  discoveredCount?: number;
  source?: string;
}

interface SearchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  pastQueries: SearchHistoryItem[];
  onRerunQuery: (query: SearchHistoryItem) => void;
}

export default function SearchHistoryModal({
  isOpen,
  onClose,
  pastQueries,
  onRerunQuery
}: SearchHistoryModalProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState<string>('all');

  if (!isOpen) return null;

  // Formatter for readable timestamps
  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return 'Recently';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'Recently';
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(date);
    } catch {
      return 'Recently';
    }
  };

  // Filter history items
  const filteredHistory = pastQueries.filter((item) => {
    const queryStr = `${item.city || ''} ${item.country || ''} ${item.category || ''} ${(item.platforms || []).join(' ')}`.toLowerCase();
    const matchesSearch = queryStr.includes(searchFilter.toLowerCase());
    const matchesPlatform = selectedPlatformFilter === 'all' || 
      (item.platforms && item.platforms.includes(selectedPlatformFilter)) ||
      (selectedPlatformFilter === 'Google Places API' && (!item.platforms || item.platforms.length === 0));
    return matchesSearch && matchesPlatform;
  });

  // The active discovery source is intentionally singular; legacy platform metadata is not presented as current evidence.
  const allPlatforms = pastQueries.length > 0 ? ['Google Places API'] : [];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Provider Query History
                <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                  {pastQueries.length} total
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Review provider queries with timestamps and re-run the same Google Places search
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="px-6 py-3 border-b border-zinc-800/80 bg-zinc-950/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Keyword Filter Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by city, territory, or business category..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-hidden focus:border-zinc-700"
            />
          </div>

          {/* Platform filter pill select */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedPlatformFilter('all')}
              className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 ${
                selectedPlatformFilter === 'all'
                  ? 'bg-orange-500 text-zinc-950 font-bold'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              All Provider Queries
            </button>
            {allPlatforms.slice(0, 4).map((plat) => (
              <button
                key={plat}
                type="button"
                onClick={() => setSelectedPlatformFilter(plat)}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 ${
                  selectedPlatformFilter === plat
                    ? 'bg-orange-500 text-zinc-950 font-bold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {plat}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Scrollable History List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 space-y-2">
              <History className="h-8 w-8 mx-auto text-zinc-600 opacity-60" />
              <p className="text-xs font-medium">
                {searchFilter || selectedPlatformFilter !== 'all'
                  ? 'No search history matches your filters.'
                  : 'No provider queries recorded yet. Start a search above.'}
              </p>
            </div>
          ) : (
            filteredHistory.map((queryItem, idx) => {
              const platforms = ['Google Places API'];
              const resultCount = typeof queryItem.discoveredCount === 'number' ? queryItem.discoveredCount : null;
              const formattedTime = formatTimestamp(queryItem.timestamp);

              return (
                <div
                  key={queryItem.id || `hist_row_${idx}`}
                  className="group bg-zinc-950/60 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  {/* Query Main Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                        {queryItem.category}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-xs font-medium text-zinc-300 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        {queryItem.city}, {queryItem.country}
                      </span>
                      <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        {resultCount === null ? 'count unavailable' : `+${resultCount} returned`}
                      </span>
                    </div>

                    {/* Platforms / Citations badge row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Layers className="h-3 w-3 text-zinc-500" />
                        Sources:
                      </span>
                      {platforms.map((p, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-medium bg-zinc-900 border border-zinc-800/90 text-zinc-400 px-1.5 py-0.5 rounded"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Timestamp & Re-run action button */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/50">
                    <div className="text-right">
                      <div className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-zinc-500" />
                        {formattedTime}
                      </div>
                      <div className="text-[10px] text-zinc-600 font-mono">
                        {queryItem.source === 'google-places-api' ? 'Google Places provider query' : 'Provider source recorded'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onRerunQuery(queryItem);
                        onClose();
                      }}
                      className="bg-zinc-900 hover:bg-orange-500 border border-zinc-700 hover:border-orange-400 text-zinc-300 hover:text-zinc-950 text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer group-hover:border-zinc-600 shadow-sm shrink-0"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Re-run Query</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-between">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-orange-400" />
            Re-running a query requests current records from Google Places; provider results may change over time.
          </div>
          <button
            onClick={onClose}
            className="text-xs font-medium text-zinc-400 hover:text-white px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
