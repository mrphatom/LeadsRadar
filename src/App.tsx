import React, { lazy, Suspense, useEffect, useState } from 'react';
import { 
  Building2, Globe, Search, PlusCircle, Download, RefreshCw, 
  Grid, List, SlidersHorizontal, Trash2, CheckSquare, Sparkles, 
  Share2, ArrowRightLeft, Database, HelpCircle, CheckCircle2, ChevronRight,
  LogOut, UserCheck, Menu, X, BarChart2, ShieldCheck, Zap, ExternalLink, Lock
} from 'lucide-react';
import { BusinessLead, CountryType, LeadStatus } from './types';
import SearchScanner from './components/SearchScanner';
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const SecurityAuditModal = lazy(() => import('./components/SecurityAuditModal'));
const LeadDetailsModal = lazy(() => import('./components/LeadDetailsModal'));
const AddLeadModal = lazy(() => import('./components/AddLeadModal'));
const CheckoutSandbox = lazy(() => import('./components/CheckoutSandbox'));
const SubscriptionModal = lazy(() => import('./components/SubscriptionModal'));
import LeadCard, { LeadCardSkeleton } from './components/LeadCard';
import { checkGuestSearchLimit, checkGuestSaveLimit } from './services/guestAuditService';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { AuthView } from './components/AuthView';
import { PREPOPULATED_LEADS } from './seedData';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { apiFetch } from './apiClient';
import { sanitizeLeadArray } from './utils/leadSanitizer';
// @ts-ignore
import brandLogo from './assets/images/logo_1779885424761.png';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  writeBatch 
} from 'firebase/firestore';

function AppContent() {
  const { user, loading: authLoading, logout, profile } = useAuth();
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [pastQueries, setPastQueries] = useState<any[]>([]);
  const [syncing, setSyncing] = useState<boolean>(true);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  const reportPersistenceError = (message: string) => {
    setPersistenceError(message);
  };
  
  const [config, setConfig] = useState<{ hasApiKey: boolean; message: string }>({ hasApiKey: false, message: '' });
  
  // Subscription management states
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [paystackSuccessNotice, setPaystackSuccessNotice] = useState<string | null>(null);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  useEffect(() => {
    document.title = "LeadsRadar | AI-Driven Outreach Lead Generator";
    
    // Set favicon dynamically
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.type = 'image/png';
      link.rel = 'shortcut icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    } else {
      link.rel = 'shortcut icon';
      link.type = 'image/png';
    }
    link.href = brandLogo;
  }, []);

  useEffect(() => {
    if (window.location.pathname !== '/billing-success' || !user) return;

    const reference = new URLSearchParams(window.location.search).get('reference');
    if (!reference) {
      setPaystackSuccessNotice('We could not find a payment reference. Your account was not upgraded.');
      return;
    }

    let active = true;
    apiFetch('/api/paystack/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.verified) {
          throw new Error('Payment verification failed.');
        }
        if (active) {
          window.history.replaceState({}, document.title, '/');
          setPaystackSuccessNotice('Your LeadsRadar Pro payment was verified successfully.');
          setTimeout(() => setPaystackSuccessNotice(null), 10000);
        }
      })
      .catch(() => {
        if (active) {
          setPaystackSuccessNotice('We could not verify this payment yet. Your account was not upgraded.');
        }
      });

    return () => {
      active = false;
    };
  }, [user]);
  
  // Dashboard/CRM Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCountry, setFilterCountry] = useState<CountryType | 'All'>('All');
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'All'>('All');

  // Modals state
  const [selectedLead, setSelectedLead] = useState<BusinessLead | null>(null);
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [viewTab, setViewTab] = useState<'leads' | 'analytics'>('leads');

  // Load API config once on mount
  useEffect(() => {
    apiFetch('/api/config')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error("Error connecting to Express backend API config:", err));
  }, []);

  // Sync current user's personalized leads and scan history live from Firestore
  useEffect(() => {
    if (!user) {
      setLeads([]);
      setPastQueries([]);
      setSyncing(false);
      return;
    }

    setSyncing(true);

    // Initial load from local fallbacks to ensure instant display
    const fallbackLeadsKey = `fallback_leads_${user.uid}`;
    const fallbackQueriesKey = `fallback_queries_${user.uid}`;
    
    try {
      const cachedLeads = localStorage.getItem(fallbackLeadsKey);
      if (cachedLeads) {
        setLeads(sanitizeLeadArray(JSON.parse(cachedLeads)));
      }
      const cachedQueries = localStorage.getItem(fallbackQueriesKey);
      if (cachedQueries) {
        setPastQueries(JSON.parse(cachedQueries));
      }
    } catch (err) {
      console.warn("Failed to load local cached leads/queries fallbacks:", err);
    }

    // 1. Snapshot Listener for B2B Leads
    const leadsQuery = query(collection(db, 'leads'), where('ownerId', '==', user.uid));
    const unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
      const loadedLeads: BusinessLead[] = [];
      snapshot.forEach((docSnap) => {
        loadedLeads.push(docSnap.data() as BusinessLead);
      });

      // Sort chronological descending
      loadedLeads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const sanitizedLeads = sanitizeLeadArray(loadedLeads);
      try {
        localStorage.setItem(fallbackLeadsKey, JSON.stringify(sanitizedLeads));
      } catch (err) {
        console.warn("Failed to update local cached leads backup:", err);
      }

      setLeads(sanitizedLeads);
      setSyncing(false);
    }, (error) => {
      console.warn("Background leads database sync failed gently (permissions/connection issues):", error);
      setSyncing(false);
    });

    // 2. Snapshot Listener for Scan History Queries
    const queriesQuery = query(collection(db, 'queries'), where('userId', '==', user.uid));
    const unsubscribeQueries = onSnapshot(queriesQuery, (snapshot) => {
      const loadedQueries: any[] = [];
      snapshot.forEach((docSnap) => {
        loadedQueries.push(docSnap.data());
      });
      // Sort newest first
      loadedQueries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      try {
        localStorage.setItem(fallbackQueriesKey, JSON.stringify(loadedQueries));
      } catch (err) {
        console.warn("Failed to update local cached queries backup:", err);
      }

      setPastQueries(loadedQueries);
    }, (error) => {
      console.warn("Background scan queries database sync failed gently:", error);
    });

    return () => {
      unsubscribeLeads();
      unsubscribeQueries();
    };
  }, [user]);

  // Save successful user scan query to Personal search logs
  const handleSaveSearchQuery = async (
    city: string, 
    country: string, 
    category: string, 
    discoveredCount: number, 
    source: string,
    platforms?: string[]
  ) => {
    if (!user) return;
    const queryId = `query_${Date.now()}`;
    const queryObj = {
      id: queryId,
      userId: user.uid,
      city,
      country,
      category,
      discoveredCount,
      source,
      platforms: platforms || ['Google Maps', 'Yelp', 'LinkedIn', 'Trustpilot'],
      timestamp: new Date().toISOString()
    };

    // Proactively update UI state instantly
    setPastQueries(prev => {
      const updated = [queryObj, ...prev];
      try {
        localStorage.setItem(`fallback_queries_${user.uid}`, JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to set proactive local queries search log:", e);
      }
      return updated;
    });

    const queryRef = doc(db, 'queries', queryId);
    try {
      await setDoc(queryRef, queryObj);
    } catch (err) {
      console.warn("Failed to log query in remote db, local proactive query list preserved:", err);
    }
  };

  // Add new crawl discoveries directly to user Firestore db
  const handleLeadsDiscovered = async (newLeads: BusinessLead[], source: string) => {
    if (!user) return;
    const searchCheck = checkGuestSearchLimit();
    if (!searchCheck.allowed) {
      alert("Guest Mode Discovery Limit Reached (5/5 searches). Open 'Security & Guest' in the navigation bar to switch to Pro Authenticated Mode for unlimited access!");
      setIsSecurityModalOpen(true);
      return;
    }

    const formattedDiscoveries = sanitizeLeadArray(newLeads.map((newL, index) => {
      const leadId = newL.id || `lead_crawl_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`;
      return {
        ...newL,
        id: leadId,
        ownerId: user.uid,
        status: newL.status || 'new',
        createdAt: newL.createdAt || new Date().toISOString(),
        activityLog: newL.activityLog || [
          {
            id: `log_crawler_${Date.now()}_${index}`,
            type: 'note' as const,
            timestamp: new Date().toISOString(),
            title: 'Discovered via Search Grounding',
            detail: `Prospect index fetched from web crawl sources (${source}).`
          }
        ]
      };
    }));

    const uniqueDiscoveries = formattedDiscoveries.filter((candidate, index, all) => {
      const duplicateInCurrentState = leads.some((existing) =>
        existing.name.trim().toLowerCase() === candidate.name.trim().toLowerCase()
        || (candidate.phone && existing.phone === candidate.phone)
      );
      const duplicateInBatch = all.findIndex((item) =>
        item.name.trim().toLowerCase() === candidate.name.trim().toLowerCase()
        || (candidate.phone && item.phone === candidate.phone)
      ) !== index;
      return !duplicateInCurrentState && !duplicateInBatch;
    });
    const previousLeads = leads;

    setLeads(prev => {
      const updated = [...uniqueDiscoveries, ...prev];
      try {
        localStorage.setItem(`fallback_leads_${user.uid}`, JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to save proactive local discoveries list:", e);
      }
      return updated;
    });

    try {
      const batch = writeBatch(db);
      uniqueDiscoveries.forEach(fd => {
        const leadRef = doc(db, 'leads', fd.id);
        batch.set(leadRef, fd);
      });
      await batch.commit();
      setPersistenceError(null);
    } catch (err) {
      setLeads(previousLeads);
      reportPersistenceError('Discovery results could not be saved. Your changes were rolled back; please retry.');
      console.warn("Failed to batch save discoveries in Firestore:", err);
    }
  };

  // Manual record enrollment dispatch
  const handleAddManualLead = async (newLead: BusinessLead) => {
    if (!user) return;
    const saveCheck = checkGuestSaveLimit();
    if (!saveCheck.allowed) {
      alert("Guest Mode Save Limit Reached (15/15 leads saved). Open 'Security & Guest' in the navigation bar to switch to Pro Authenticated Mode for unlimited capacity!");
      setIsSecurityModalOpen(true);
      return;
    }
    const fullLead = {
      ...newLead,
      ownerId: user.uid
    };

    const previousLeads = leads;
    setLeads(prev => [fullLead, ...prev]);

    const leadRef = doc(db, 'leads', newLead.id);
    try {
      await setDoc(leadRef, fullLead);
      setPersistenceError(null);
    } catch (err) {
      setLeads(previousLeads);
      reportPersistenceError('Manual lead could not be saved. Your change was rolled back; please retry.');
      console.warn("Failed to save manual lead inside remote Firestore:", err);
    }
  };

  // Updates parameters on selected B2B detail sheet (notes, outreach pitches...)
  const handleUpdateLead = async (updatedLead: BusinessLead) => {
    if (!user) return;
    const fullLead = {
      ...updatedLead,
      ownerId: user.uid
    };

    const previousLeads = leads;
    const previousSelectedLead = selectedLead;
    setLeads(prev => prev.map(l => l.id === updatedLead.id ? fullLead : l));

    if (selectedLead && selectedLead.id === updatedLead.id) {
      setSelectedLead(fullLead);
    }

    const leadRef = doc(db, 'leads', updatedLead.id);
    try {
      await setDoc(leadRef, fullLead);
      setPersistenceError(null);
    } catch (err) {
      setLeads(previousLeads);
      setSelectedLead(previousSelectedLead);
      reportPersistenceError('Lead changes could not be saved. Your change was rolled back; please retry.');
      console.warn("Failed to commit lead update inside remote Firestore:", err);
    }
  };

  // Promote stages from general card columns
  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    if (!user) return;
    const leadToChange = leads.find(l => l.id === leadId);
    if (!leadToChange) return;

    const statusLogItem = {
      id: `log_status_${Date.now()}`,
      type: 'status_change' as const,
      timestamp: new Date().toISOString(),
      title: 'Status Transition Highlight',
      detail: `Pipeline updated directly from general dashboard list to "${newStatus}"`
    };

    const updatedLead: BusinessLead = {
      ...leadToChange,
      status: newStatus,
      activityLog: [statusLogItem, ...leadToChange.activityLog]
    };

    const previousLeads = leads;
    const previousSelectedLead = selectedLead;
    setLeads(prev => prev.map(l => l.id === leadId ? updatedLead : l));

    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead(updatedLead);
    }

    const leadRef = doc(db, 'leads', leadId);
    try {
      await setDoc(leadRef, updatedLead);
      setPersistenceError(null);
    } catch (err) {
      setLeads(previousLeads);
      setSelectedLead(previousSelectedLead);
      reportPersistenceError('Status change could not be saved. Your change was rolled back; please retry.');
      console.warn("Failed to set lead status change in remote Firestore:", err);
    }
  };

  // Purge personalized space and re-sync seed items
  const handlePurgeDatabase = async () => {
    if (!user) return;
    if (window.confirm("Are you sure you want to reset your personalized sales database? This will delete all customized scan and manual logs created under your account, and re-populate the standard seed prospects.")) {
      setSyncing(true);
      try {
        const batch = writeBatch(db);
        
        // Fetch all current user's leads first
        const leadsQuery = query(collection(db, 'leads'), where('ownerId', '==', user.uid));
        const qSnap = await getDocs(leadsQuery);
        qSnap.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });

        // Seed fresh prepopulated items
        for (const item of PREPOPULATED_LEADS) {
          const freshId = `seed_${item.id}_${user.uid}`;
          const seedRef = doc(db, 'leads', freshId);
          batch.set(seedRef, {
            ...item,
            id: freshId,
            ownerId: user.uid,
            createdAt: new Date().toISOString()
          });
        }

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'leads');
      } finally {
        setSyncing(false);
      }
    }
  };

  // Delete individual prospect from logging
  const handleDeleteLead = async (leadId: string) => {
    if (!user) return;
    if (window.confirm("Disenroll and delete this lead permanently from lists?")) {
      const leadRef = doc(db, 'leads', leadId);
      try {
        await deleteDoc(leadRef);
        setSelectedLead(null);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `leads/${leadId}`);
      }
    }
  };

  // CSV Exporter Compiler
  const handleExportCSV = () => {
    if (leads.length === 0) {
      return;
    }

    const headers = ["Business Name", "Country", "City", "Address", "Category", "Phone", "Email", "Status", "Notes/Audit Details", "Created Date"];
    const rows = leads.map(l => [
      l.name,
      l.country,
      l.city,
      l.address || "N/A",
      l.category,
      l.phone,
      l.email,
      l.status,
      l.notes.replace(/"/g, '""'),
      new Date(l.createdAt).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Webless_Biz_Leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Multi-select bulk state
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  const handleToggleSelectLead = (leadId: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const handleBulkStatusChange = async (newStatus: LeadStatus) => {
    if (selectedLeadIds.size === 0 || !user) return;
    setSyncing(true);
    try {
      const batch = writeBatch(db);
      const selectedList = leads.filter(l => selectedLeadIds.has(l.id));
      
      selectedList.forEach(leadToChange => {
        const statusLogItem = {
          id: `log_status_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          type: 'status_change' as const,
          timestamp: new Date().toISOString(),
          title: 'Bulk Status Transition Highlight',
          detail: `Pipeline state altered collectively to "${newStatus}" via bulk manager.`
        };

        const updatedLead: BusinessLead = {
          ...leadToChange,
          status: newStatus,
          activityLog: [statusLogItem, ...leadToChange.activityLog]
        };

        const leadRef = doc(db, 'leads', leadToChange.id);
        batch.set(leadRef, updatedLead);
      });

      await batch.commit();
      setSelectedLeadIds(new Set());
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'bulk leads update');
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkExportCSV = () => {
    const selectedLeads = leads.filter(l => selectedLeadIds.has(l.id));
    if (selectedLeads.length === 0) return;

    const headers = ["Business Name", "Country", "City", "Address", "Category", "Phone", "Email", "Status", "Notes/Audit Details", "Created Date", "Tags"];
    const rows = selectedLeads.map(l => [
      l.name,
      l.country,
      l.city,
      l.address || "N/A",
      l.category,
      l.phone,
      l.email,
      l.status,
      l.notes.replace(/"/g, '""'),
      new Date(l.createdAt).toLocaleDateString(),
      (l.tags || []).join("; ")
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bulk_Selected_Leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkDelete = async () => {
    if (selectedLeadIds.size === 0 || !user) return;
    if (window.confirm(`Are you sure you want to permanently delete the ${selectedLeadIds.size} selected leads?`)) {
      setSyncing(true);
      try {
        const batch = writeBatch(db);
        selectedLeadIds.forEach(id => {
          const leadRef = doc(db, 'leads', id);
          batch.delete(leadRef);
        });
        await batch.commit();
        setSelectedLeadIds(new Set());
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'bulk leads delete');
      } finally {
        setSyncing(false);
      }
    }
  };

  // Filter application pipeline list logic
  const filteredLeads = leads.filter(lead => {
    const searchLower = searchQuery.toLowerCase();
    const queryMatches = !searchQuery || 
      lead.name.toLowerCase().includes(searchLower) ||
      lead.city.toLowerCase().includes(searchLower) ||
      lead.category.toLowerCase().includes(searchLower) ||
      lead.phone.toLowerCase().includes(searchLower) ||
      lead.email.toLowerCase().includes(searchLower) ||
      lead.notes.toLowerCase().includes(searchLower);

    const countryMatches = filterCountry === 'All' || lead.country === filterCountry;
    const statusMatches = filterStatus === 'All' || lead.status === filterStatus;

    return queryMatches && countryMatches && statusMatches;
  });

  // Loading indicator for background auth checks
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center gap-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
        <Building2 className="h-10 w-10 text-orange-500 animate-spin z-10" />
        <p className="text-xs font-semibold text-zinc-500 tracking-wider uppercase animate-pulse z-10">Initializing Workspace Securites...</p>
      </div>
    );
  }

  // Development-only payment simulator; production checkout returns only provider URLs.
  if (import.meta.env.DEV && user && window.location.pathname === '/checkout-sandbox') {
    return <Suspense fallback={<div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center text-sm">Loading checkout…</div>}><CheckoutSandbox /></Suspense>;
  }

  // Not logged in -> Show Sign in panel
  if (!user) {
    return <AuthView />;
  }

  const isPro = profile?.subscriptionTier === 'pro';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 transition-all selection:bg-orange-500/10 selection:text-orange-400 leading-normal font-sans">
      {persistenceError && (
        <div role="alert" className="fixed inset-x-0 top-0 z-[100] bg-rose-950/95 border-b border-rose-500/40 text-rose-100 px-4 py-2 text-xs text-center">
          {persistenceError}
          <button type="button" className="ml-3 underline hover:no-underline" onClick={() => setPersistenceError(null)}>
            Dismiss
          </button>
        </div>
      )}
      
      {/* Sleek Minimalist Sticky Navbar */}
      <header className="bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-14 flex items-center justify-between gap-6">
            
            {/* Minimal Brand */}
            <div className="flex items-center gap-2 shrink-0" title="Home">
              <div className="h-8 w-8 bg-zinc-900 border border-zinc-800/80 rounded-xl flex items-center justify-center text-orange-400 shadow-sm hover:border-zinc-700 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" strokeDasharray="4 2" className="opacity-40" />
                  <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                  <path d="M12 3V6M12 18V21M3 12H6M18 12H21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </div>
              {isPro && (
                <span className="bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                  PRO
                </span>
              )}
            </div>

            {/* Clean Segmented Navigation (Center) */}
            <div className="hidden sm:flex items-center gap-1 bg-zinc-900/60 p-1 rounded-full border border-zinc-800/60">
              <button
                onClick={() => setViewTab('leads')}
                className={`px-4 py-1 text-xs font-medium rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewTab === 'leads'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Grid className="h-3.5 w-3.5" />
                Leads
              </button>
              <button
                onClick={() => setViewTab('analytics')}
                className={`px-4 py-1 text-xs font-medium rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewTab === 'analytics'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Analytics
              </button>
            </div>

            {/* Minimalist Right Controls */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Security Audit & Guest Mode Governance Button */}
              <button
                onClick={() => setIsSecurityModalOpen(true)}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Security Audit & Guest Mode Governance"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-orange-400" />
                <span className="hidden lg:inline">Security & Guest</span>
              </button>

              {/* New Prospect Button */}
              <button
                onClick={() => setIsAddingLead(true)}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <PlusCircle className="h-3.5 w-3.5 text-orange-400" />
                <span className="hidden md:inline">New Prospect</span>
                <span className="md:hidden">New</span>
              </button>

              {/* Upgrade Pro Trigger (if free) */}
              {!isPro && (
                <button
                  type="button"
                  onClick={() => setIsSubscriptionModalOpen(true)}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-95 text-zinc-950 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer uppercase tracking-wide"
                  title="Upgrade limits & AI enrichment"
                >
                  <Sparkles className="h-3 w-3 fill-current" />
                  <span>Pro</span>
                </button>
              )}

              {/* Clean Minimalist User Avatar & Logout */}
              <div className="flex items-center gap-1.5 pl-1.5 border-l border-zinc-800/80">
                <div 
                  className="h-7 w-7 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-zinc-300 text-xs font-semibold select-none cursor-default"
                  title={user.email || 'Member'}
                >
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                </div>
                <button
                  onClick={logout}
                  className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>

              {/* Mobile Burger Menu Toggle */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="sm:hidden text-zinc-400 hover:text-white p-1.5 rounded-lg transition-colors"
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Minimal Mobile Navigation Drawer */}
          {isMobileMenuOpen && (
            <div className="sm:hidden border-t border-zinc-800/80 py-3 space-y-2 animate-fadeIn">
              <div className="flex bg-zinc-900/60 p-1 rounded-full border border-zinc-800/60">
                <button
                  onClick={() => {
                    setViewTab('leads');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-full transition-all flex items-center justify-center gap-1.5 ${
                    viewTab === 'leads'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Grid className="h-3.5 w-3.5" />
                  Leads
                </button>
                <button
                  onClick={() => {
                    setViewTab('analytics');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-full transition-all flex items-center justify-center gap-1.5 ${
                    viewTab === 'analytics'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Analytics
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {paystackSuccessNotice && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-2xl text-emerald-400 text-xs font-semibold flex items-center gap-3 animate-fadeIn">
            <CheckSquare className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
            <span>{paystackSuccessNotice}</span>
          </div>
        </div>
      )}

      {/* Main Container screen content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
         {/* TOP COMPONENT: Search Discover Crawler (only shown on Dashboard tab) */}
        {viewTab === 'leads' && (
          <SearchScanner 
            onLeadsDiscovered={handleLeadsDiscovered}
            isDemoMode={!config.hasApiKey}
            onSaveQuery={handleSaveSearchQuery}
            pastQueries={pastQueries}
            onUpgradeClick={() => setIsSubscriptionModalOpen(true)}
          />
        )}

        {/* TAB CONTROLS RENDERING */}
        {viewTab === 'analytics' ? (
          <Suspense fallback={<div className="h-48 rounded-2xl border border-zinc-800 bg-zinc-900/40 animate-pulse" aria-label="Loading analytics" />}>
            <AnalyticsDashboard leads={leads} />
          </Suspense>
        ) : (
          <div className="space-y-6">
            
            {/* Pipeline Filtering Controls */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Text Search field */}
              <div className="relative w-full md:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Filter by keyword, city, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2 rounded-lg border border-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-zinc-950 text-zinc-200 placeholder:text-zinc-500"
                />
              </div>

              {/* Advanced Filter selections */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-center md:justify-end">
                {/* Territory/Country filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500 font-medium">Country:</span>
                  <select
                    value={filterCountry}
                    onChange={(e) => setFilterCountry(e.target.value as CountryType | 'All')}
                    className="text-xs bg-zinc-950 border border-zinc-800 text-zinc-300 py-1.5 px-2 rounded-lg focus:outline-hidden font-medium"
                  >
                    <option value="All">All Territories</option>
                    <option value="USA">USA 🇺🇸</option>
                    <option value="UK">UK 🇬🇧</option>
                    <option value="Germany">Germany 🇩🇪</option>
                    <option value="Canada">Canada 🇨🇦</option>
                  </select>
                </div>

                {/* Status Column CRM filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500 font-medium">Status:</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as LeadStatus | 'All')}
                    className="text-xs bg-zinc-950 border border-zinc-800 text-zinc-300 py-1.5 px-2.5 rounded-lg focus:outline-hidden font-medium"
                  >
                    <option value="All">All Pipeline Stages</option>
                    <option value="new">🆕 New Prospects</option>
                    <option value="contacted">📞 Contact Established</option>
                    <option value="proposal">💬 Proposal Sent</option>
                    <option value="negotiating">🤝 Negotiating</option>
                    <option value="won">🎉 Deals Won</option>
                    <option value="rejected">🛑 Disqualified</option>
                  </select>
                </div>

                <span className="text-zinc-800 h-6 w-px mx-1 block hidden sm:block" />

                {/* CSV download & Restore commands */}
                <button
                  onClick={handleExportCSV}
                  disabled={leads.length === 0}
                  className="text-xs text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 py-1.5 px-3 rounded-lg bg-zinc-950 flex items-center gap-1.5 cursor-pointer font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-zinc-800"
                  title={leads.length === 0 ? "No prospects available" : "Export Leads to CSV"}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CRM
                </button>

                <button
                  onClick={handlePurgeDatabase}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-950/50 hover:border-red-900 py-1.5 px-2.5 rounded-lg bg-red-500/10 flex items-center gap-1 cursor-pointer font-semibold transition-colors"
                  title="Reset to default seed databases"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>

            </div>

            {/* LEADS LISTING RESULT COUNT AND MASTER SELECT */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-500 font-semibold px-2">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white select-none">
                  <input
                    type="checkbox"
                    checked={filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.has(l.id))}
                    onChange={() => {
                      const allSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.has(l.id));
                      setSelectedLeadIds(prev => {
                        const next = new Set(prev);
                        if (allSelected) {
                          filteredLeads.forEach(l => next.delete(l.id));
                        } else {
                          filteredLeads.forEach(l => next.add(l.id));
                        }
                        return next;
                      });
                    }}
                    className="h-4 w-4 rounded border-zinc-750 bg-zinc-950 text-orange-500 focus:ring-orange-500/20 focus:ring-offset-zinc-950 cursor-pointer accent-orange-500"
                  />
                  <span>Select All ({filteredLeads.length})</span>
                </label>
                <span className="text-zinc-800">|</span>
                <span>
                  Displaying <strong>{filteredLeads.length}</strong> matching prospects out of <strong>{leads.length}</strong> total pipeline logs.
                </span>
              </div>
              <span className="font-mono text-[10px] text-zinc-650 flex items-center gap-1 animate-pulse justify-end">
                <Database className="h-3.5 w-3.5" />
                {syncing ? 'SYNCING CLOUD PORTAL...' : 'PERSONAL CLOUD DATA ONLINE'}
              </span>
            </div>

            {/* Floating Bulk Actions Bar */}
            {selectedLeadIds.size > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/25 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn">
                <div className="flex items-center gap-2 text-xs text-orange-400 font-bold">
                  <CheckSquare className="h-4.5 w-4.5 shrink-0" />
                  <span>{selectedLeadIds.size} prospects active in batch select</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
                  {/* Change status for selected */}
                  <div className="flex items-center gap-1 text-xs text-zinc-400">
                    <span>Change Status:</span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleBulkStatusChange(e.target.value as LeadStatus);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                      className="text-xs bg-zinc-950 border border-zinc-805 text-zinc-200 py-1.5 px-2.5 rounded-lg focus:outline-hidden font-semibold cursor-pointer"
                    >
                      <option value="" disabled>-- select stage --</option>
                      <option value="new">🆕 New Prospect</option>
                      <option value="contacted">📞 Contacted</option>
                      <option value="proposal">💬 Pitch Sent</option>
                      <option value="negotiating">🤝 Negotiating</option>
                      <option value="won">🎉 Account Won!</option>
                      <option value="rejected">🛑 Disqualified</option>
                    </select>
                  </div>
                  
                  {/* Export Selected to CSV */}
                  <button
                    onClick={handleBulkExportCSV}
                    className="text-xs bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:text-white text-zinc-300 py-1.5 px-3 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Export selected rows to CSV"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export Selected
                  </button>

                  {/* Disenroll Selected */}
                  <button
                    onClick={handleBulkDelete}
                    className="text-xs bg-red-500/10 border border-red-950/40 hover:border-red-900 text-red-400 hover:text-red-300 py-1.5 px-3 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Bulk Delete selected records"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Selected
                  </button>
                  
                  {/* Cancel Select */}
                  <button
                    onClick={() => setSelectedLeadIds(new Set())}
                    className="text-xs text-zinc-400 hover:text-zinc-200 py-1.5 px-2.5 font-medium cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* RESULTS BLOCKS GRID */}
            {syncing && filteredLeads.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
                {[...Array(6)].map((_, index) => (
                  <LeadCardSkeleton key={index} />
                ))}
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="bg-zinc-900/50 border rounded-3xl border-zinc-800 p-12 text-center animate-fadeIn">
                <div className="p-3 bg-zinc-950 text-zinc-500 rounded-full w-fit mx-auto mb-3.5 border border-zinc-800">
                  <SlidersHorizontal className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-white text-base">No Matching Web Prospects Found</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  Adjust active filter toggles, clear query inputs, or deploy a new region search crawler query above to enroll new accounts.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
                {filteredLeads.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onSelect={setSelectedLead}
                    onStatusChange={handleStatusChange}
                    onUpdate={handleUpdateLead}
                    isSelected={selectedLeadIds.has(lead.id)}
                    onToggleSelect={() => handleToggleSelectLead(lead.id)}
                  />
                ))}
              </div>
            )}

          </div>
        )}

      </main>

      {/* CRM Details Modal Drawer */}
      {selectedLead && (
        <Suspense fallback={null}>
          <LeadDetailsModal
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onUpdateLead={handleUpdateLead}
            onUpgradeClick={() => setIsSubscriptionModalOpen(true)}
          />
        </Suspense>
      )}

      {/* Subscription Pricing Checkout Portal popup */}
      <Suspense fallback={null}>
      <SubscriptionModal 
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
      />
      </Suspense>

      {/* Manual Prospect Addition Form Sheet */}
      {isAddingLead && (
        <Suspense fallback={null}>
          <AddLeadModal
            onClose={() => setIsAddingLead(false)}
            onAddLead={handleAddManualLead}
          />
        </Suspense>
      )}

      {/* Security & Guest Mode Governance Modal */}
      <Suspense fallback={null}>
      <SecurityAuditModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />
      </Suspense>

      {/* Modern Responsive SaaS Footer */}
      <footer className="mt-20 border-t border-zinc-800/80 bg-zinc-950/90 text-zinc-400">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
          {/* Top Footer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-zinc-800/80">
            {/* Brand Column */}
            <div className="md:col-span-5 space-y-3.5">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-zinc-900 border border-zinc-800/80 rounded-xl flex items-center justify-center text-orange-400 shadow-sm">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" strokeDasharray="4 2" className="opacity-40" />
                    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="2" fill="currentColor" />
                    <path d="M12 3V6M12 18V21M3 12H6M18 12H21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="bg-orange-500/10 border border-orange-500/25 text-orange-400 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">
                  v3.0
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
                AI-driven local business intelligence & automated zero-hallucination B2B outreach engine. Designed to discover real brick-and-mortar prospects needing a modern web presence.
              </p>
              <div className="inline-flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-zinc-300 font-medium text-[11px]">System Status: All Services Operational</span>
              </div>
            </div>

            {/* Quick Views */}
            <div className="md:col-span-3 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white font-mono">Workspace Views</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button 
                    onClick={() => { setViewTab('leads'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="hover:text-orange-400 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Grid className="h-3.5 w-3.5 text-zinc-500" />
                    Lead Manager CRM
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => { setViewTab('analytics'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="hover:text-orange-400 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <BarChart2 className="h-3.5 w-3.5 text-zinc-500" />
                    KPI Analytics & Reporting
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setIsAddingLead(true)}
                    className="hover:text-orange-400 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <PlusCircle className="h-3.5 w-3.5 text-zinc-500" />
                    Manual Prospect Enroll
                  </button>
                </li>
                {!isPro && (
                  <li>
                    <button 
                      onClick={() => setIsSubscriptionModalOpen(true)}
                      className="text-orange-400 hover:underline font-semibold cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Upgrade to Pro Workspace
                    </button>
                  </li>
                )}
              </ul>
            </div>

            {/* Security & Verification Badges */}
            <div className="md:col-span-4 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white font-mono">Security & Intelligence</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2.5 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-xl text-xs">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-white">Zero-Hallucination Search Grounding</div>
                    <div className="text-[11px] text-zinc-400">Verified real-time public telephone numbers & directories only.</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-xl text-xs">
                  <Lock className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-white">256-bit Cloud Workspace Encryption</div>
                    <div className="text-[11px] text-zinc-400">Personalized Firestore data isolation & Paystack verified checkout.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Footer Bar */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
            <div>
              © {new Date().getFullYear()} All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <span className="hover:text-zinc-300 transition-colors cursor-pointer">Privacy Policy</span>
              <span className="hover:text-zinc-300 transition-colors cursor-pointer">Terms of Service</span>
              <span className="hover:text-zinc-300 transition-colors cursor-pointer">API Documentation</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
