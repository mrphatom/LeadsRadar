import React, { useState, useEffect } from 'react';
import { 
  Building2, Globe, Search, PlusCircle, Download, RefreshCw, 
  Grid, List, SlidersHorizontal, Trash2, CheckSquare, Sparkles, 
  Share2, ArrowRightLeft, Database, HelpCircle, CheckCircle2, ChevronRight,
  LogOut, UserCheck, Menu, X
} from 'lucide-react';
import { BusinessLead, CountryType, LeadStatus } from './types';
import SearchScanner from './components/SearchScanner';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import LeadCard from './components/LeadCard';
import LeadDetailsModal from './components/LeadDetailsModal';
import AddLeadModal from './components/AddLeadModal';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { AuthView } from './components/AuthView';
import CheckoutSandbox from './components/CheckoutSandbox';
import SubscriptionModal from './components/SubscriptionModal';
import { PREPOPULATED_LEADS } from './seedData';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
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
  const { user, loading: authLoading, logout, profile, updateUserSubscription } = useAuth();
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [pastQueries, setPastQueries] = useState<any[]>([]);
  const [syncing, setSyncing] = useState<boolean>(true);
  
  const [config, setConfig] = useState<{ hasApiKey: boolean; message: string }>({ hasApiKey: false, message: '' });
  
  // Subscription management states
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [paystackSuccessNotice, setPaystackSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.pathname === '/billing-success' && user) {
      // Proactively upgrade user directly in Firestore DB
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30); // 30 days premium subscription
      
      updateUserSubscription(
        'pro',
        'month',
        expiryDate.toISOString(),
        `paystack_sub_${Date.now()}`
      )
        .then(() => {
          // Clear routing trace safely
          window.history.replaceState({}, document.title, '/');
          setPaystackSuccessNotice("🎉 Your LeadsRadar Pro upgrade is verified on Paystack! Enjoy 20 daily scans, SWOT competitive matrices, and conversational chatbot guides.");
          setTimeout(() => setPaystackSuccessNotice(null), 10000);
        })
        .catch((err) => {
          console.error("Error committing Paystack subscription upgrade:", err);
        });
    }
  }, [user, updateUserSubscription]);
  
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
    fetch('/api/config')
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
        setLeads(JSON.parse(cachedLeads));
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
      
      try {
        localStorage.setItem(fallbackLeadsKey, JSON.stringify(loadedLeads));
      } catch (err) {
        console.warn("Failed to update local cached leads backup:", err);
      }

      setLeads(loadedLeads);
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
    source: string
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

    const formattedDiscoveries = newLeads.map((newL, index) => {
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
    });

    // Proactively update local UI state instantly
    setLeads(prev => {
      const updated = [...prev];
      formattedDiscoveries.forEach(fd => {
        const alreadyListed = updated.some(l => 
          l.name.toLowerCase() === fd.name.toLowerCase() || 
          (l.phone && l.phone === fd.phone)
        );
        if (!alreadyListed) {
          updated.push(fd);
        }
      });
      // Sort newest first
      updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      try {
        localStorage.setItem(`fallback_leads_${user.uid}`, JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to save proactive local discoveries list:", e);
      }
      return updated;
    });

    try {
      const batch = writeBatch(db);
      formattedDiscoveries.forEach(fd => {
        const leadRef = doc(db, 'leads', fd.id);
        batch.set(leadRef, fd);
      });
      await batch.commit();
    } catch (err) {
      console.warn("Failed to batch save discoveries in Firestore, fallback local memory state preserved:", err);
    }
  };

  // Manual record enrollment dispatch
  const handleAddManualLead = async (newLead: BusinessLead) => {
    if (!user) return;
    const fullLead = {
      ...newLead,
      ownerId: user.uid
    };

    // Proactively update local UI state instantly
    setLeads(prev => {
      const updated = [fullLead, ...prev];
      try {
        localStorage.setItem(`fallback_leads_${user.uid}`, JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to save manual lead locally:", e);
      }
      return updated;
    });

    const leadRef = doc(db, 'leads', newLead.id);
    try {
      await setDoc(leadRef, fullLead);
    } catch (err) {
      console.warn("Failed to save manual lead inside remote Firestore, local state preserved:", err);
    }
  };

  // Updates parameters on selected B2B detail sheet (notes, outreach pitches...)
  const handleUpdateLead = async (updatedLead: BusinessLead) => {
    if (!user) return;
    const fullLead = {
      ...updatedLead,
      ownerId: user.uid
    };

    // Proactively update local UI state instantly
    setLeads(prev => {
      const updated = prev.map(l => l.id === updatedLead.id ? fullLead : l);
      try {
        localStorage.setItem(`fallback_leads_${user.uid}`, JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to save updated lead locally:", e);
      }
      return updated;
    });

    if (selectedLead && selectedLead.id === updatedLead.id) {
      setSelectedLead(fullLead);
    }

    const leadRef = doc(db, 'leads', updatedLead.id);
    try {
      await setDoc(leadRef, fullLead);
    } catch (err) {
      console.warn("Failed to commit lead update inside remote Firestore, local state preserved:", err);
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

    // Proactively update local UI state instantly
    setLeads(prev => {
      const updated = prev.map(l => l.id === leadId ? updatedLead : l);
      try {
        localStorage.setItem(`fallback_leads_${user.uid}`, JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to save lead status change locally:", e);
      }
      return updated;
    });

    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead(updatedLead);
    }

    const leadRef = doc(db, 'leads', leadId);
    try {
      await setDoc(leadRef, updatedLead);
    } catch (err) {
      console.warn("Failed to set lead status status change in remote Firestore, local state preserved:", err);
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

  // Intercept local Stripe Sandbox Gateway URL routing
  if (user && window.location.pathname === '/checkout-sandbox') {
    return <CheckoutSandbox />;
  }

  // Not logged in -> Show Sign in panel
  if (!user) {
    return <AuthView />;
  }

  const isPro = profile?.subscriptionTier === 'pro';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 transition-all selection:bg-orange-500/10 selection:text-orange-400 leading-normal font-sans">
      
      {/* Upper Navigation Title/Control Strip */}
      <header className="bg-zinc-950 border-b border-zinc-900 sticky top-0 z-40 px-4 md:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Header Top Row (Brand identity, plus mobile burger menu on mobile) */}
          <div className="flex items-center justify-between w-full md:w-auto">
            {/* Branded Identity */}
            <div className="flex items-center gap-2.5">
              <div className="bg-orange-500 text-zinc-950 p-2 rounded-xl flex items-center justify-center font-bold shadow-md shadow-orange-500/10 shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-lg md:text-xl font-extrabold text-white tracking-tight block">
                  LeadsRadar <span className="font-medium text-orange-500 font-mono text-xs md:text-sm ml-1">v3.0</span>
                </span>
                <span className="text-[10px] md:text-xs text-zinc-500 font-medium block">
                  B2B Outreach Engine • Personalized Cloud Workspace
                </span>
              </div>
            </div>

            {/* Mobile Actions Overlay: Pro Badge & Burger */}
            <div className="flex items-center gap-2 md:hidden">
              {isPro && (
                <div className="bg-orange-500/15 border border-orange-500/20 px-2 py-0.5 rounded text-[8px] font-extrabold text-orange-400 tracking-wider">
                  👑 PRO
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white p-2 rounded-xl cursor-pointer"
                aria-label="Toggle navigation menu"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Desktop-only Panel OR Mobile expanded View */}
          <div className={`${isMobileMenuOpen ? 'flex' : 'hidden md:flex'} flex-col md:flex-row items-stretch md:items-center gap-3.5 md:gap-4 w-full md:w-auto mt-2 md:mt-0 animate-fadeIn md:animate-none`}>
            
            {/* Divider line for mobile */}
            <div className="h-px bg-zinc-900 md:hidden my-1" />

            {/* Tab Switches (Leads vs Analytics Dashboard) */}
            <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl w-full md:w-auto">
              <button
                onClick={() => {
                  setViewTab('leads');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex-1 md:flex-none px-4 py-2 md:py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center ${
                  viewTab === 'leads'
                    ? 'bg-orange-500 text-zinc-950 font-extrabold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Lead Manager
              </button>
              <button
                onClick={() => {
                  setViewTab('analytics');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex-1 md:flex-none px-4 py-2 md:py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center ${
                  viewTab === 'analytics'
                    ? 'bg-orange-500 text-zinc-950 font-extrabold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                KPI Analytics
              </button>
            </div>

            {/* Quick manual enroll triggers */}
            <button
              onClick={() => {
                setIsAddingLead(true);
                setIsMobileMenuOpen(false);
              }}
              className="w-full md:w-auto bg-zinc-100 text-zinc-950 hover:bg-white px-4 py-2 md:py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Manual Enroll
            </button>

            {/* User Identity Display & Sign Out */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3.5 md:gap-2.5 bg-zinc-900 border border-zinc-800 p-3 md:py-1 md:pl-3.5 md:pr-1.5 rounded-2xl md:rounded-xl shrink-0 select-none">
              
              {/* Pro Upgrade Trigger */}
              {!isPro ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsSubscriptionModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-zinc-950 px-4 py-2 md:py-1.5 rounded-md md:rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/11 cursor-pointer uppercase tracking-wider animate-pulse hover:animate-none hover:scale-102 transition-all shrink-0"
                  title="Unlock advanced analysis tools"
                >
                  <Sparkles className="h-3.5 w-3.5 text-zinc-955 fill-current" />
                  Upgrade limits
                </button>
              ) : (
                <div className="hidden md:flex bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-orange-400 tracking-wider items-center gap-1 shrink-0 uppercase font-mono">
                  👑 Pro Active
                </div>
              )}

              <div className="flex items-center md:items-end justify-between md:justify-start md:flex-col pl-1 border-t md:border-t-0 border-zinc-850 pt-2.5 md:pt-0 md:pl-1 md:border-l border-zinc-805">
                <div className="flex flex-col items-start md:items-end">
                  <span className="text-xs font-bold text-white leading-tight flex items-center gap-1">
                    <UserCheck className="h-3 w-3 text-orange-500 shrink-0" />
                    {user.displayName || 'CRM Member'}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono leading-none">{user.email}</span>
                </div>
                {!isPro && (
                  <span className="text-[8px] font-mono text-zinc-500 tracking-wide md:hidden">Free Plan Caps</span>
                )}
                {isPro && (
                  <span className="text-[8px] font-extrabold text-orange-400 tracking-wider md:hidden uppercase font-mono">👑 PRO ACTIVE</span>
                )}
              </div>

              {/* Sign out button */}
              <button
                onClick={logout}
                className="w-full md:w-auto bg-zinc-955 md:bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-red-400 py-2 md:p-2 rounded-xl md:rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1 md:block"
                title="Exit Work Session"
              >
                <LogOut className="h-3.5 w-3.5 animate-pulse" />
                <span className="text-xs font-semibold md:hidden">Logout Workspace</span>
              </button>
            </div>

          </div>

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
          <AnalyticsDashboard leads={leads} />
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
            {filteredLeads.length === 0 ? (
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
        <LeadDetailsModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdateLead={handleUpdateLead}
          onUpgradeClick={() => setIsSubscriptionModalOpen(true)}
        />
      )}

      {/* Subscription Pricing Checkout Portal popup */}
      <SubscriptionModal 
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
      />

      {/* Manual Prospect Addition Form Sheet */}
      {isAddingLead && (
        <AddLeadModal
          onClose={() => setIsAddingLead(false)}
          onAddLead={handleAddManualLead}
        />
      )}

      {/* Sticky Bottom Credit Line */}
      <footer className="mt-16 border-t border-zinc-900 bg-zinc-950 py-6 text-center text-[11px] text-zinc-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3.5 font-medium">
          <span>
            LeadsRadar • Full-Stack AI Lead Gen Interface.
          </span>
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
