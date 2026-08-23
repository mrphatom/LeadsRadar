import React, { useEffect, useState } from 'react';
import { 
  Search, Globe, MapPin, Building2, Loader2, Sparkles, 
  AlertCircle, CheckCircle2, History, Calendar, Clock, 
  Settings, RefreshCw, Sliders, CheckSquare, Square, Lock, Zap
} from 'lucide-react';
import { CountryType, BusinessLead } from '../types';
import { apiFetch } from '../apiClient';
import { useAuth } from './AuthProvider';
import SearchHistoryModal from './SearchHistoryModal';
import { isProSubscriptionActive } from '../utils/subscription';

interface SearchScannerProps {
  onLeadsDiscovered: (newLeads: BusinessLead[], source: string, citations?: any[]) => void;
  discoveryAvailable: boolean;
  onSaveQuery: (city: string, country: string, category: string, discoveredCount: number, source: string, platforms?: string[]) => void;
  pastQueries: any[];
  onUpgradeClick: () => void;
}

const DISCOVERY_PROVIDER_LABEL = 'Google Places API';

const COMMON_NICHES = [
  'Bakery',
  'Dentist',
  'Electrician',
  'Plumbing',
  'Roofing',
  'Auto Mechanic',
  'Cafe',
  'Hair Salon',
  'Spa & Salon',
  'Gym',
  'Boutique',
  'Local Restaurant',
  'Landscaping'
];

const DEFAULT_CITIES: Record<CountryType, string[]> = {
  USA: ['Austin', 'Seattle', 'Miami', 'Chicago', 'Denver'],
  UK: ['London', 'Oxford', 'Manchester', 'Bristol', 'Edinburgh'],
  Germany: ['Munich', 'Berlin', 'Hamburg', 'Frankfurt', 'Cologne'],
  Canada: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa']
};

export default function SearchScanner({ onLeadsDiscovered, discoveryAvailable, onSaveQuery, pastQueries, onUpgradeClick }: SearchScannerProps) {
  const { profile } = useAuth();
  const [scannerTab, setScannerTab] = useState<'scan' | 'updater'>('scan');
  
  const isPro = isProSubscriptionActive(profile);
  const schedulerStorageKey = profile?.uid || 'anonymous';

  // Compute total scans performed on current calendar day (UTC)
  const todayStr = new Date().toISOString().split('T')[0];
  const queriesTodayCount = pastQueries.filter(q => q.timestamp && q.timestamp.split('T')[0] === todayStr).length;

  // Standard Scan block states
  const [country, setCountry] = useState<CountryType>('USA');
  const [customCountry, setCustomCountry] = useState<string>('');
  const [city, setCity] = useState<string>('Austin');
  const [category, setCategory] = useState<string>('Bakery');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [scanSource, setScanSource] = useState<string | null>(null);

  // Weekly Sync/Scheduler states
  const [schedulerActive, setSchedulerActive] = useState<boolean>(false);
  const [selectedCities, setSelectedCities] = useState<string[]>(['Austin', 'London', 'Munich', 'Toronto']);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [nextSyncTime, setNextSyncTime] = useState<string>('');
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const selectedPlatforms = [DISCOVERY_PROVIDER_LABEL];
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!profile?.uid) return;
    setLastSyncTime(localStorage.getItem(`radar_last_sync_time_${profile.uid}`) || '');
    setNextSyncTime(localStorage.getItem(`radar_next_sync_time_${profile.uid}`) || '');
  }, [profile?.uid]);

  const handleRerunQuery = async (queryItem: any) => {
    const targetCountry = queryItem.country || 'USA';
    const targetCity = queryItem.city || 'Austin';
    const targetCategory = queryItem.category || 'Bakery';
    const targetPlatforms = selectedPlatforms;

    setCountry(targetCountry);
    setCity(targetCity);
    if (COMMON_NICHES.includes(targetCategory)) {
      setCategory(targetCategory);
    } else {
      setCategory('Custom');
      setCustomCategory(targetCategory);
    }
    setLoading(true);
    setError(null);
    setSuccessCount(null);
    setScanSource(null);

    if (!discoveryAvailable) {
      setError('Real lead discovery is unavailable because the server-side Google Places provider is not configured. No synthetic results are shown.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch('/api/search-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: targetCountry,
          city: targetCity,
          category: targetCategory,
          platforms: targetPlatforms
        })
      });

      if (!response.ok) {
        throw new Error('Google Places provider request failed; no unverified results were imported.');
      }

      const data = await response.json();
      if (data.leads && Array.isArray(data.leads)) {
        if (data.leads.length === 0) {
          setError(`No eligible ${DISCOVERY_PROVIDER_LABEL} records matching "${targetCategory}" were returned in ${targetCity}.`);
        } else {
          onLeadsDiscovered(data.leads, data.source, data.citations);
          setSuccessCount(data.leads.length);
          setScanSource(data.source || null);
          onSaveQuery(targetCity, targetCountry, targetCategory, data.leads.length, data.source || 'google-places-api', targetPlatforms);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while re-running the provider search.');
    } finally {
      setLoading(false);
    }
  };

  const handleCitySelect = (selectedCity: string) => {
    setCity(selectedCity);
  };

  const toggleCitySelection = (cCity: string) => {
    if (selectedCities.includes(cCity)) {
      setSelectedCities(selectedCities.filter(c => c !== cCity));
    } else {
      setSelectedCities([...selectedCities, cCity]);
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessCount(null);
    setScanSource(null);

    if (!discoveryAvailable) {
      setError('Real lead discovery is unavailable because the server-side Google Places provider is not configured. No synthetic results are shown.');
      setLoading(false);
      return;
    }

    // The server enforces the real daily quota. Browser history is informational only.
    const finalCategory = category === 'Custom' ? customCategory : category;
    if (!finalCategory.trim()) {
      setError('Please provide a business niche/category.');
      setLoading(false);
      return;
    }

    const steps = [
      `Requesting structured places from ${DISCOVERY_PROVIDER_LABEL}...`,
      `Searching ${city}, ${country} for ${finalCategory}...`,
      'Filtering permanently closed places and records with a website listed by the provider...',
      'Keeping only fields returned by the provider; missing contacts stay unlisted.',
      'Preparing provider-cited records for your workspace...'
    ];

    let stepIndex = 0;
    setStatusMessage(steps[0]);
    const stepInterval = setInterval(() => {
      stepIndex++;
      if (stepIndex < steps.length) {
        setStatusMessage(steps[stepIndex]);
      }
    }, 1500);

    try {
      const response = await apiFetch('/api/search-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country,
          city,
          category: finalCategory,
          platforms: selectedPlatforms
        })
      });

      if (!response.ok) {
        throw new Error('Google Places provider request failed; no unverified results were imported.');
      }

      const data = await response.json();
      clearInterval(stepInterval);

      if (data.leads && Array.isArray(data.leads)) {
        if (data.leads.length === 0) {
          setError(`No eligible ${DISCOVERY_PROVIDER_LABEL} records matching "${finalCategory}" were returned in ${city}.`);
        } else {
          onLeadsDiscovered(data.leads, data.source, data.citations);
          setSuccessCount(data.leads.length);
          setScanSource(data.source || null);
          onSaveQuery(city, country, finalCategory, data.leads.length, data.source || 'google-places-api', selectedPlatforms);
        }
      } else {
        throw new Error('Invalid response structure received from server.');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message || 'An error occurred while finding web prospects.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerWeeklySync = async () => {
    if (selectedCities.length === 0) {
      setSyncLogs(["[ERROR] No active territories selected. Please check at least one region to run synchronization."]);
      return;
    }
    
    setIsSyncingAll(true);
    setSyncLogs([]);
    setSyncProgress(5);
    
    const logging = (msg: string) => {
      setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    if (!discoveryAvailable) {
      setSyncLogs(['[ERROR] Google Places discovery is not configured. No synthetic records will be generated.']);
      setIsSyncingAll(false);
      return;
    }

    logging("Preparing a manual provider search plan for this browser session...");
    await new Promise(r => setTimeout(r, 600));
    setSyncProgress(15);

    logging(`Indexing target regions: ${selectedCities.join(', ')}`);
    await new Promise(r => setTimeout(r, 500));
    setSyncProgress(25);

    logging('Provider filter: permanently closed places excluded; records with a listed website excluded.');
    await new Promise(r => setTimeout(r, 600));
    setSyncProgress(35);

    let totalAdded = 0;
    const activeCategory = category === 'Custom' ? (customCategory || 'Cafe') : category;
    
    const syncCategory = activeCategory;

    for (let i = 0; i < selectedCities.length; i++) {
      const currentCity = selectedCities[i];
      
      // Map city to appropriate country
      let targetCountry: CountryType = 'USA';
      if (['London', 'Oxford', 'Manchester', 'Bristol', 'Edinburgh'].includes(currentCity)) {
        targetCountry = 'UK';
      } else if (['Munich', 'Berlin', 'Hamburg', 'Frankfurt', 'Cologne'].includes(currentCity)) {
        targetCountry = 'Germany';
      } else if (['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa'].includes(currentCity)) {
        targetCountry = 'Canada';
      }

      logging(`[SEARCH] Querying Google Places for "${syncCategory}" in ${currentCity}, ${targetCountry}...`);
      setSyncProgress(35 + Math.floor((i / selectedCities.length) * 55));
      await new Promise(r => setTimeout(r, 800));

      try {
        const response = await apiFetch('/api/search-leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country: targetCountry,
            city: currentCity,
            category: syncCategory,
            platforms: selectedPlatforms
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.leads && Array.isArray(data.leads) && data.leads.length > 0) {
            onLeadsDiscovered(data.leads, data.source || DISCOVERY_PROVIDER_LABEL, data.citations);
            logging(`[SAVED] Added ${data.leads.length} provider records for ${currentCity}.`);
            totalAdded += data.leads.length;
            onSaveQuery(currentCity, targetCountry, activeCategory, data.leads.length, data.source || 'google-places-api', selectedPlatforms);
          } else {
            logging(`[SKIP] No eligible provider records returned in ${currentCity}.`);
          }
        } else {
            logging(`[WARN] Provider request failed for ${currentCity}.`);
        }
      } catch (err) {
        logging(`[ERROR] Sync connection error on ${currentCity}: ${err}`);
      }
      await new Promise(r => setTimeout(r, 500));
    }

    setSyncProgress(100);
    const nowStr = new Date().toLocaleString();
    const nextStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString();
    setLastSyncTime(nowStr);
    setNextSyncTime(nextStr);
    localStorage.setItem(`radar_last_sync_time_${schedulerStorageKey}`, nowStr);
    localStorage.setItem(`radar_next_sync_time_${schedulerStorageKey}`, nextStr);

    logging(`Manual provider update completed. Added ${totalAdded} records across active territories.`);
    await new Promise(r => setTimeout(r, 1500));
    setIsSyncingAll(false);
  };

  return (
    <div className="bg-zinc-900/50 rounded-3xl border border-zinc-800 p-6 mb-8 transition-all hover:border-zinc-700/80">
      
      {/* HEADER SECTION WITH TOGGLE TABS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-5 border-b border-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-orange-500" />
              Provider-backed Prospect Discovery
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Discover public prospects and run manual territory scans. Persistent background scheduling requires a separately configured job service.
            </p>
          </div>

          <div className="bg-zinc-950 px-3.5 py-2 rounded-xl border border-zinc-800 flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">Provider Usage</span>
              <span className="text-xs text-zinc-300 font-bold">
                {queriesTodayCount} <span className="text-zinc-500 font-normal">browser history entries today</span>
              </span>
            </div>
            {!isPro ? (
              <button
                type="button"
                onClick={onUpgradeClick}
                className="bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-zinc-950 border border-orange-500/25 px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-all uppercase tracking-wide"
              >
                <Zap className="h-2.5 w-2.5 fill-current" /> Upgrade Limits
              </button>
            ) : (
              <span className="bg-orange-500/15 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20 text-[9px] font-extrabold uppercase font-mono tracking-wider">
                👑 PRO ACTIVATED
              </span>
            )}
          </div>
        </div>
        
        {/* TAB CONTROLLERS */}
        <div className="flex bg-zinc-950 border border-zinc-900 p-1 rounded-xl shrink-0 self-start lg:self-center" role="group" aria-label="Discovery workflow">
          <button
            type="button"
            aria-pressed={scannerTab === 'scan'}
            onClick={() => setScannerTab('scan')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              scannerTab === 'scan'
                ? 'bg-orange-500 text-zinc-950 font-bold shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            On-Demand Scanner
          </button>
          <button
            type="button"
            aria-pressed={scannerTab === 'updater'}
            onClick={() => setScannerTab('updater')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              scannerTab === 'updater'
                ? 'bg-orange-500 text-zinc-950 font-bold shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Manual Territory Plan
          </button>
        </div>
      </div>

      {/* TAB 1: ON-DEMAND RADAR SCANNER */}
      {scannerTab === 'scan' ? (
        <form onSubmit={handleScan} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Country Selection */}
            <div>
              <label htmlFor="target-country" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-zinc-500" /> Target Country
              </label>
              <div className="grid grid-cols-1 gap-2">
                <select
                  id="target-country"
                  value={['USA', 'UK', 'Germany', 'Canada'].includes(country) ? country : 'Custom'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'Custom') {
                      setCountry('Custom');
                      setCustomCountry('');
                    } else {
                      setCountry(val);
                      setCustomCountry('');
                      if (DEFAULT_CITIES[val as 'USA' | 'UK' | 'Germany' | 'Canada'] && !DEFAULT_CITIES[val as 'USA' | 'UK' | 'Germany' | 'Canada'].includes(city)) {
                        setCity(DEFAULT_CITIES[val as 'USA' | 'UK' | 'Germany' | 'Canada'][0]);
                      }
                    }
                  }}
                  className="w-full text-sm py-2 px-3 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium"
                >
                  <option value="USA" className="bg-zinc-950 text-zinc-300">USA 🇺🇸</option>
                  <option value="UK" className="bg-zinc-950 text-zinc-300">United Kingdom 🇬🇧</option>
                  <option value="Germany" className="bg-zinc-950 text-zinc-300">Germany 🇩🇪</option>
                  <option value="Canada" className="bg-zinc-950 text-zinc-300">Canada 🇨🇦</option>
                  <option value="Custom" className="bg-zinc-950 text-zinc-300">-- Custom Country --</option>
                </select>

                {(!['USA', 'UK', 'Germany', 'Canada'].includes(country) || country === 'Custom') && (
                  <input
                    id="custom-country"
                    type="text"
                    value={customCountry || (country !== 'Custom' ? country : '')}
                    onChange={(e) => {
                      setCustomCountry(e.target.value);
                      setCountry(e.target.value);
                    }}
                    placeholder="Specify Country (e.g. France, Japan)"
                    className="w-full text-sm py-2 px-3 mt-1 rounded-lg border border-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-zinc-950 text-zinc-200"
                    required
                  />
                )}
              </div>
            </div>

            {/* City Coordinate */}
            <div>
              <label htmlFor="target-city" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-zinc-500" /> City / Region
              </label>
              <div className="relative">
                <input
                  id="target-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Austin or Berlin"
                  className="w-full text-sm py-2 px-3 pr-8 rounded-lg border border-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-zinc-950 text-zinc-200 placeholder:text-zinc-600"
                  required
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {DEFAULT_CITIES[country as 'USA' | 'UK' | 'Germany' | 'Canada'] ? (
                  DEFAULT_CITIES[country as 'USA' | 'UK' | 'Germany' | 'Canada'].map((suggestedCity) => (
                    <button
                      key={suggestedCity}
                      type="button"
                      onClick={() => handleCitySelect(suggestedCity)}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                        city.toLowerCase() === suggestedCity.toLowerCase()
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 font-medium'
                          : 'text-zinc-500 border-zinc-800 hover:bg-zinc-900'
                      }`}
                    >
                      {suggestedCity}
                    </button>
                  ))
                ) : (
                  <span className="text-[10px] text-zinc-600">Type any custom city / region above</span>
                )}
              </div>
            </div>

            {/* Business Niches */}
            <div>
              <label htmlFor="business-category" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-zinc-500" /> Business Category
              </label>
              <div className="grid grid-cols-1 gap-2">
                <select
                  id="business-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-sm py-2 px-3 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium"
                >
                  {COMMON_NICHES.map((niche) => (
                    <option key={niche} value={niche} className="bg-zinc-950 text-zinc-300">
                      {niche}
                    </option>
                  ))}
                  <option value="Custom" className="bg-zinc-950 text-zinc-300">-- Custom Category --</option>
                </select>

                {category === 'Custom' && (
                  <input
                    id="custom-category"
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Specify Custom Niche (e.g. Electrician)"
                    className="w-full text-sm py-2 px-3 mt-1 rounded-lg border border-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-zinc-950 text-zinc-200"
                    required
                  />
                )}
              </div>
            </div>
          </div>

          {/* Evidence policy */}
          <div className="flex flex-wrap items-center gap-3 bg-zinc-950/45 p-3.5 rounded-2xl border border-zinc-900 text-xs">
            <span className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">Evidence Policy:</span>
            <span className="flex items-center gap-2 text-zinc-400">
              <CheckSquare className="h-4.5 w-4.5 text-orange-500 shrink-0" />
              Google Places records only; no generated business identities, contact details, ratings, or social profiles.
            </span>
          </div>

          {/* Scan Button & Visual Progress Logs */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:flex-1">
              {loading && (
                <div className="space-y-1.5 w-full bg-zinc-950 rounded-2xl p-3 border border-zinc-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-orange-400 animate-pulse">
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    <span>{statusMessage}</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                    <div className="bg-orange-500 h-full rounded-full transition-all duration-1000 w-[65%]" />
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    [GOOGLE PLACES API] Returning provider fields only; email and social data are not inferred...
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-950 text-rose-400 text-xs px-3 py-2.5 rounded-xl">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-400" />
                  <p>{error}</p>
                </div>
              )}

              {successCount !== null && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-950 text-emerald-400 text-xs px-3 py-2 rounded-xl">
                    <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
                    <p>
                      Imported <strong>{successCount}</strong> Google Places records with no website listed by the provider. Review each source before outreach.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !discoveryAvailable}
              className={`w-full sm:w-auto shrink-0 px-6 py-2.5 text-sm font-semibold rounded-lg text-white shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                loading
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 text-zinc-950 hover:shadow-md font-bold'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Prospecting...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Start On-Demand Search
                </>
              )}
            </button>
          </div>

          {/* Personalized Search History logs */}
          {pastQueries && pastQueries.length > 0 && (
            <div className="pt-4 border-t border-zinc-900 mt-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-orange-400" />
                  <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                    Personalized Scan History ({pastQueries.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Clock className="h-3 w-3" />
                  <span>Provider Query History & Timestamps →</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                {pastQueries.slice(0, 8).map((q) => (
                  <button
                    key={q.id || `${q.timestamp || 'history'}_${q.city || 'city'}_${q.category || 'category'}`}
                    type="button"
                    onClick={() => handleRerunQuery(q)}
                    className="text-[11px] px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-orange-500/40 bg-zinc-950 text-zinc-300 hover:text-white flex items-center gap-2 transition-all text-left cursor-pointer group"
                    title="Re-run this provider query"
                  >
                    <span className="font-bold text-orange-400 group-hover:text-orange-300">{q.category}</span>
                    <span className="text-zinc-600">•</span>
                    <span>{q.city}, {q.country}</span>
                    <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                      {typeof q.discoveredCount === 'number' ? `+${q.discoveredCount}` : 'count unavailable'}
                    </span>
                    <RefreshCw className="h-3 w-3 text-zinc-500 group-hover:text-orange-400 ml-1 transition-transform group-hover:rotate-45" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      ) : (
        /* TAB 2: WEEKLY SCAN PLANNER */
        profile?.subscriptionTier !== 'pro' ? (
          <div className="bg-zinc-950/40 border border-orange-500/15 p-8 rounded-2xl text-center space-y-4 animate-fadeIn relative overflow-hidden">
              <p className="text-[10px] uppercase tracking-[0.18em] text-orange-400/80 font-semibold">Pro workspace feature</p>
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl" />
            <div className="mx-auto w-12 h-12 rounded-full bg-orange-500/15 flex items-center justify-center border border-orange-500/20 mb-2">
              <Lock className="h-5 w-5 text-orange-400" />
            </div>
            <h3 className="text-white text-base font-extrabold flex items-center justify-center gap-1.5">
              <Sparkles className="h-4.5 w-4.5 text-orange-500" /> Unlock Weekly Scan Planning
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              Prepare a repeatable territory scan plan and run it manually from this authenticated session. Persistent background jobs and alerts require a separate job service.
            </p>
            
            <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto pt-2 text-[10px] font-mono">
              <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl">
                <span className="text-zinc-500 block uppercase">Session Plan</span>
                <span className="text-white font-bold font-sans">Manual</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl">
                <span className="text-zinc-500 block uppercase">Pro Limit</span>
                <span className="text-orange-400 font-bold font-sans">20 scans/day</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl">
                <span className="text-zinc-500 block uppercase">Alerts</span>
                <span className="text-white font-bold font-sans">Not configured</span>
              </div>
            </div>

            <div className="pt-4 max-w-xs mx-auto">
              <button
                type="button"
                onClick={onUpgradeClick}
                className="w-full bg-orange-500 hover:bg-orange-600 font-extrabold text-zinc-950 py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-orange-500/15 hover:scale-102 active:scale-98 transition-all"
              >
                <Zap className="h-4 w-4 text-zinc-950 fill-zinc-950" /> Upgrade with MoonPay
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fadeIn">
          <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Status indicators */}
            <div className="space-y-2">
              <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Planner Status</span>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  aria-pressed={schedulerActive}
                  aria-label={schedulerActive ? 'Disable manual territory plan' : 'Enable manual territory plan'}
                  onClick={() => setSchedulerActive(!schedulerActive)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-hidden focus:ring-2 focus:ring-orange-500/40 ${
                    schedulerActive ? 'bg-orange-500' : 'bg-zinc-800'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-zinc-900 shadow-xs ring-0 transition duration-200 ${
                    schedulerActive ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
                <span className="text-xs font-bold text-white">
                  {schedulerActive ? "Ready for manual run" : "Paused"}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Applies a manual scan against selected regions during this browser session.
              </p>
            </div>

            {/* Run summaries */}
            <div className="space-y-1">
              <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Sync Chronology logs</span>
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                <span>Last Sync: <strong>{lastSyncTime || 'Pending First Cycle'}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Next planned session: <strong>{nextSyncTime || 'Not planned'}</strong></span>
              </div>
            </div>

            {/* Planner filtration info */}
            <div className="space-y-1">
              <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Audit Profile Filters</span>
              <div className="text-xs space-y-1 text-zinc-300">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  <span>Business status: permanently closed places excluded</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  <span>Website filter: no website listed by provider</span>
                </div>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Regions Subscriptions Checklist */}
            <div className="bg-zinc-950/25 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-orange-500" />
                  Manual Scan Regions ({selectedCities.length})
              </h3>
              <p className="text-[10px] text-zinc-500 mb-4 leading-relaxed">
                  Choose territories for a manual session run. Each request uses Google Places and stores only returned records.
              </p>

              <div className="grid grid-cols-2 gap-3.5">
                {['Austin', 'Seattle', 'London', 'Oxford', 'Munich', 'Toronto', 'Vancouver'].map((cityOption) => {
                  const isChecked = selectedCities.includes(cityOption);
                  return (
                    <button
                      key={cityOption}
                      type="button"
                      onClick={() => toggleCitySelection(cityOption)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs text-left cursor-pointer transition-all ${
                        isChecked 
                          ? 'border-orange-500/25 bg-orange-500/5 text-orange-400 font-semibold'
                          : 'border-zinc-900 bg-zinc-950/50 text-zinc-500 hover:border-zinc-800'
                      }`}
                    >
                      <span>{cityOption}</span>
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4 text-orange-500" />
                      ) : (
                        <Square className="h-4 w-4 text-zinc-800" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sync Command & Live console */}
            <div className="bg-zinc-950/25 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Sliders className="h-4 w-4 text-orange-500" />
                  Run Provider Sync
                </h3>
                <p className="text-[10px] text-zinc-500 mb-4 leading-relaxed">
                  Run a sequential Google Places search across the checked territories. No background job or synthetic fallback is used.
                </p>

                {/* Automation Log Feed console */}
                {syncLogs.length > 0 && (
                  <div role="log" aria-live="polite" className="bg-zinc-950/80 border border-zinc-900 rounded-xl p-3 h-32 overflow-y-auto font-mono text-[9px] text-zinc-400 space-y-1 scrollbar-thin select-text">
                    {syncLogs.map((logStr, lIdx) => (
                      <div key={lIdx} className={logStr.includes('[SEARCH]') ? 'text-orange-400/80' : logStr.includes('[SAVED]') ? 'text-emerald-400' : logStr.includes('[ERROR]') ? 'text-red-400' : 'text-zinc-400'}>
                        {logStr}
                      </div>
                    ))}
                  </div>
                )}

                {isSyncingAll && (
                  <div className="mt-3.5 space-y-1">
                    <div className="flex justify-between text-[10px] text-zinc-500 font-medium font-mono">
                      <span>Sync Progression...</span>
                      <span>{syncProgress}%</span>
                    </div>
                    <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-orange-500 h-full transition-all duration-300" style={{ width: `${syncProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleTriggerWeeklySync}
                  disabled={isSyncingAll}
                  className="flex-1 bg-white hover:bg-zinc-100 text-zinc-950 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                  {isSyncingAll ? 'Running Sync Pipeline...' : 'Run Manual Territory Sync'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )
    )}

      {/* Provider Query History & Re-run Modal */}
      <SearchHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        pastQueries={pastQueries}
        onRerunQuery={(q) => {
          setIsHistoryModalOpen(false);
          handleRerunQuery(q);
        }}
      />
    </div>
  );
}
