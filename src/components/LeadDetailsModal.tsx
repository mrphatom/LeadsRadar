import React, { useState } from 'react';
import { 
  X, Phone, Mail, MapPin, Building2, Calendar, ClipboardList, 
  Sparkles, Loader2, Copy, Check, MessageSquare, History, PlusCircle,
  TrendingDown, RefreshCw, Send, CheckSquare, AlertCircle, Bot, Zap, Lock, BarChart2, UserCheck,
  ExternalLink, Tag
} from 'lucide-react';
import { BusinessLead, LeadStatus, ActivityLogItem } from '../types';
import { useAuth } from './AuthProvider';

interface LeadDetailsModalProps {
  lead: BusinessLead;
  onClose: () => void;
  onUpdateLead: (updatedLead: BusinessLead) => void;
  onUpgradeClick: () => void;
}

export default function LeadDetailsModal({ lead, onClose, onUpdateLead, onUpgradeClick }: LeadDetailsModalProps) {
  const { profile } = useAuth();
  const isPro = profile?.subscriptionTier === 'pro';

  // Helper to color-code user tags beautifully
  const getTagStylesSidebar = (tag: string) => {
    const t = tag.toLowerCase();
    if (t.includes('high') || t.includes('priority')) {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
    }
    if (t.includes('follow') || t.includes('wait') || t.includes('later')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
    }
    if (t.includes('warm') || t.includes('hot') || t.includes('interest')) {
      return 'bg-sky-500/10 text-sky-400 border-sky-500/25';
    }
    return 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50';
  };

  const handleAddTag = (tagToAdd: string) => {
    const sanitized = tagToAdd.trim().replace(/[^\w-]/g, '').toLowerCase();
    if (!sanitized) return;
    const currentTags = lead.tags || [];
    if (!currentTags.includes(sanitized)) {
      onUpdateLead({
        ...lead,
        tags: [...currentTags, sanitized]
      });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = lead.tags || [];
    onUpdateLead({
      ...lead,
      tags: currentTags.filter(t => t !== tagToRemove)
    });
  };

  const [loadingPitch, setLoadingPitch] = useState(false);
  const [pitchError, setPitchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'outreach' | 'timeline' | 'analysis' | 'assistant'>('outreach');
  
  // Custom Logger state
  const [logType, setLogType] = useState<'call' | 'email' | 'comment'>('call');
  const [logMessage, setLogMessage] = useState('');
  
  // Clipboards statuses
  const [copiedEmailSub, setCopiedEmailSub] = useState(false);
  const [copiedEmailBody, setCopiedEmailBody] = useState(false);
  const [copiedPhoneScript, setCopiedPhoneScript] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);

  const triggerCopyNotice = (msg: string) => {
    setCopiedStatus(msg);
    setTimeout(() => setCopiedStatus(null), 2500);
  };

  // Generate customized B2B proposal
  const handleGeneratePitch = async () => {
    setLoadingPitch(true);
    setPitchError(null);
    try {
      const response = await fetch('/api/generate-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead })
      });

      if (!response.ok) {
        throw new Error('Failed to reach AI consultant services.');
      }

      const data = await response.json();
      
      const updatedLead: BusinessLead = {
        ...lead,
        outreachScript: data.pitch,
        outreachScriptSource: data.source,
        activityLog: [
          {
            id: `log_ai_${Date.now()}`,
            type: 'note',
            timestamp: new Date().toISOString(),
            title: data.source === 'rate-limit-fallback' ? 'Outreach Material Compiled (Fallback)' : 'AI Pitch Material Generated',
            detail: data.source === 'rate-limit-fallback'
              ? 'Local cache fallback sales system compiled structured templates due to current Gemini API rate limits.'
              : 'Created personalized cold email templates, calling scripts and product enhancements listings.'
          },
          ...lead.activityLog
        ]
      };
      onUpdateLead(updatedLead);
    } catch (err: any) {
      setPitchError(err.message || 'Underlying AI service rate limit reached, please write pitch manually.');
    } finally {
      setLoadingPitch(false);
    }
  };

  // SWOT Analysis states
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Conversational Coach AI states
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    {
      role: 'assistant',
      text: `Hi there! I am your AI Outreach Objection Coach. Ask me how to navigate resistance from the owners of *${lead.name}*, pitch custom B2B storefront value hooks in *${lead.city}*, or write specific cold-call rebuttals! 🎙️`
    }
  ]);

  const handleGenerateAnalysis = async () => {
    setLoadingAnalysis(true);
    setAnalysisError(null);
    try {
      const response = await fetch('/api/generate-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead })
      });

      if (!response.ok) {
        throw new Error('Failed to reach SWOT audit servers.');
      }

      const data = await response.json();
      
      const updatedLead: BusinessLead = {
        ...lead,
        analysis: data.analysis,
        activityLog: [
          {
            id: `log_analysis_${Date.now()}`,
            type: 'note',
            timestamp: new Date().toISOString(),
            title: 'SWOT Competitive Audit Compiled',
            detail: 'Conducted automated SEO estimation metrics and comprehensive competitive analysis report.'
          },
          ...lead.activityLog
        ]
      };
      onUpdateLead(updatedLead);
    } catch (err: any) {
      setAnalysisError(err.message || 'Underlying SWOT optimizer rate limit reached. Please compile analysis manually.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput;
    setChatInput('');
    const nextMessages = [...chatMessages, { role: 'user' as const, text: userMsg }];
    setChatMessages(nextMessages);
    setChatLoading(true);

    try {
      const formattedMessages = nextMessages.map(m => ({
        role: m.role,
        content: m.text
      }));

      const response = await fetch('/api/chat-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead,
          messages: formattedMessages
        })
      });

      if (!response.ok) {
        throw new Error('Objection assistant connection error.');
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant' as const, text: data.reply }]);
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant' as const,
          text: `⚠️ **Coach Error:** ${err.message || 'Connection lost.'}`
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Add custom CRM interaction logs
  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logMessage.trim()) return;

    const logTypeTitle = {
      call: 'Logged Call Outreach',
      email: 'Logged Email Outreach',
      comment: 'Manual Activity Note'
    };

    const newLogItem: ActivityLogItem = {
      id: `log_custom_${Date.now()}`,
      type: logType === 'comment' ? 'note' : logType === 'call' ? 'call' : 'email',
      timestamp: new Date().toISOString(),
      title: logTypeTitle[logType],
      detail: logMessage
    };

    // Auto update status if called or emailed
    let nextStatus: LeadStatus = lead.status;
    if (lead.status === 'new') {
      nextStatus = 'contacted';
    }

    const updatedLead: BusinessLead = {
      ...lead,
      status: nextStatus,
      activityLog: [newLogItem, ...lead.activityLog]
    };

    onUpdateLead(updatedLead);
    setLogMessage('');
    // notify status change log item if applicable
    if (lead.status === 'new') {
      const statusLogItem: ActivityLogItem = {
        id: `log_status_${Date.now()}`,
        type: 'status_change',
        timestamp: new Date().toISOString(),
        title: 'Status Updated to Contacted',
        detail: 'System transitioned state automatically after first customer record logging action.'
      };
      onUpdateLead({
        ...updatedLead,
        activityLog: [statusLogItem, newLogItem, ...lead.activityLog]
      });
    }
  };

  const handleContactAction = () => {
    if (lead.status === 'new') {
      const statusLogItem: ActivityLogItem = {
        id: `log_status_${Date.now()}`,
        type: 'status_change',
        timestamp: new Date().toISOString(),
        title: 'Status Updated to Contacted',
        detail: 'System transitioned state automatically after user initiated outreach contact.'
      };
      onUpdateLead({
        ...lead,
        status: 'contacted',
        activityLog: [statusLogItem, ...lead.activityLog]
      });
    }
  };

  const copyText = (text: string, ref: 'subject' | 'body' | 'phone') => {
    navigator.clipboard.writeText(text);
    if (ref === 'subject') {
      setCopiedEmailSub(true);
      setTimeout(() => setCopiedEmailSub(false), 2000);
    } else if (ref === 'body') {
      setCopiedEmailBody(true);
      setTimeout(() => setCopiedEmailBody(false), 2000);
    } else {
      setCopiedPhoneScript(true);
      setTimeout(() => setCopiedPhoneScript(false), 2000);
    }
    handleContactAction();
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/95 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 rounded-3xl max-w-4xl w-full border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative">
        
        {/* Floating Notification Toast */}
        {copiedStatus && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-950 border border-emerald-500/35 px-4 py-2 rounded-full text-[11px] font-bold text-emerald-400 flex items-center gap-2 shadow-xl z-50 animate-fadeIn select-none">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            {copiedStatus}
          </div>
        )}

        {/* Header Bar */}
        <div className="bg-zinc-950 text-white px-6 py-4 flex items-center justify-between shrink-0 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">
                {lead.country === 'USA' ? '🇺🇸' : lead.country === 'UK' ? '🇬🇧' : lead.country === 'Germany' ? '🇩🇪' : '🇨🇦'}
              </span>
              <h2 className="text-lg font-bold tracking-tight">{lead.name}</h2>
            </div>
            <p className="text-xs text-zinc-500">
              CRM Record Entry • Discovered {new Date(lead.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white bg-zinc-905 p-2 rounded-lg cursor-pointer transition-colors border border-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Info Strip */}
        <div className="bg-zinc-950/50 border-b border-zinc-800 px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 text-sm">
          <div className="flex items-center gap-2 text-zinc-350">
            <Building2 className="h-4.5 w-4.5 text-orange-500 shrink-0" />
            <span className="font-semibold text-white truncate">{lead.category}</span>
          </div>
          <div 
            onClick={() => {
              navigator.clipboard.writeText(lead.phone);
              triggerCopyNotice("Phone number copied to clipboard!");
              handleContactAction();
            }}
            className="flex items-center gap-2 text-zinc-350 hover:text-orange-400 transition-colors cursor-pointer group/item"
            title="Click to copy & set Contacted status"
          >
            <Phone className="h-4.5 w-4.5 text-zinc-500 group-hover/item:text-orange-500 shrink-0 transition-colors" />
            <span className="font-mono truncate select-all group-hover/item:underline">{lead.phone}</span>
          </div>
          <div 
            onClick={() => {
              navigator.clipboard.writeText(lead.email);
              triggerCopyNotice("Email address copied to clipboard!");
              handleContactAction();
            }}
            className="flex items-center gap-2 text-zinc-350 hover:text-orange-400 transition-colors cursor-pointer group/item"
            title="Click to copy & set Contacted status"
          >
            <Mail className="h-4.5 w-4.5 text-zinc-500 group-hover/item:text-orange-500 shrink-0 transition-colors" />
            <span className="font-mono truncate select-all group-hover/item:underline">{lead.email}</span>
          </div>
        </div>

        {/* Scrollable Sub-layout content */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-zinc-900">
          
          {/* LEFT/MID MAIN SCREEN (Outreach & Logging Tabs) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Tab Switches */}
            <div className="flex flex-wrap border-b border-zinc-800 gap-0.5">
              <button
                onClick={() => setActiveTab('outreach')}
                className={`pb-3 text-xs md:text-sm font-semibold border-b-2 px-3 md:px-4 flex items-center gap-2 cursor-pointer transition-colors ${
                  activeTab === 'outreach'
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-zinc-500 hover:text-orange-400'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                AI Outreach
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className={`pb-3 text-xs md:text-sm font-semibold border-b-2 px-3 md:px-4 flex items-center gap-2 cursor-pointer transition-colors ${
                  activeTab === 'timeline'
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-zinc-500 hover:text-orange-400'
                }`}
              >
                <History className="h-4 w-4" />
                Timelines ({lead.activityLog.length})
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`pb-3 text-xs md:text-sm font-semibold border-b-2 px-3 md:px-4 flex items-center gap-2 cursor-pointer transition-colors ${
                  activeTab === 'analysis'
                    ? 'border-orange-500 text-orange-400 font-bold'
                    : 'border-transparent text-zinc-500 hover:text-orange-400'
                }`}
              >
                <BarChart2 className="h-4 w-4" />
                SWOT Audit {!isPro && '⭐'}
              </button>
              <button
                onClick={() => setActiveTab('assistant')}
                className={`pb-3 text-xs md:text-sm font-semibold border-b-2 px-3 md:px-4 flex items-center gap-2 cursor-pointer transition-colors ${
                  activeTab === 'assistant'
                    ? 'border-orange-500 text-orange-400 font-bold'
                    : 'border-transparent text-zinc-550 hover:text-orange-400'
                }`}
              >
                <Bot className="h-4 w-4" />
                Sales Coach {!isPro && '⭐'}
              </button>
            </div>

            {/* TAB CONTENT: AI Outreach Generate Materials */}
            {activeTab === 'outreach' && (
              <div className="space-y-6">
                {!lead.outreachScript ? (
                  <div className="bg-orange-500/5 rounded-2xl p-6 border border-orange-500/10 flex flex-col items-center text-center">
                    <div className="p-3 bg-orange-500/10 text-orange-400 rounded-full mb-3.5">
                      <Sparkles className="h-6 w-6 animate-pulse" />
                    </div>
                    <h3 className="font-bold text-white text-base">Generate Tailored Sales Kit</h3>
                    <p className="text-xs text-zinc-400 max-w-md mt-1 mb-4 leading-relaxed">
                      Analyze this business's unique digital absence to compile custom websites pitches, mobile feature lists, call workflows, and hyper-targeted cold mail templates.
                    </p>
                    <button
                      onClick={handleGeneratePitch}
                      disabled={loadingPitch}
                      className="px-5 py-2 text-xs font-bold bg-orange-500 text-zinc-950 rounded-lg shadow-sm hover:bg-orange-600 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      {loadingPitch ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Consulting Gemini Intelligence Agent...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate Outreach Bundle
                        </>
                      )}
                    </button>
                    {pitchError && (
                      <p className="text-red-400 text-xs mt-3 bg-red-500/10 px-3 py-1.5 rounded-md border border-red-950">
                        {pitchError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6 animate-fadeIn">
                    {lead.outreachScriptSource === 'rate-limit-fallback' && (
                      <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-950 text-amber-400 text-xs p-3.5 rounded-2xl">
                        <AlertCircle className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
                        <div>
                          <p className="font-bold">Gemini API Rate-Limit Active (Fallback Compiled)</p>
                          <p className="mt-0.5 text-[10px] text-zinc-400 leading-relaxed">
                            Underlying Gemini model generation is currently rate-limited or out of quota. We have successfully generated structured, search-tailored mock outreach and B2B proposals so your sales workflows and demos can proceed perfectly uninterrupted.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Value pitch brief */}
                    <div className="bg-zinc-950 p-4 border border-zinc-800 rounded-2xl">
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                        设计师定位 (Sales Value Position)
                      </h4>
                      <p className="text-xs text-orange-400 leading-relaxed font-semibold">
                        {lead.outreachScript.valueProposition}
                      </p>
                    </div>

                    {/* Cold email script */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-850 flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-zinc-500" /> B2B Pitch Email
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyText(lead.outreachScript!.emailSubject, 'subject')}
                            className="text-xs text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 px-2 py-1 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            {copiedEmailSub ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            Copy Subject
                          </button>
                          <button
                            onClick={() => copyText(lead.outreachScript!.emailBody, 'body')}
                            className="text-xs text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 px-2 py-1 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            {copiedEmailBody ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            Copy Body
                          </button>
                          <a
                            href={`mailto:${lead.email}?subject=${encodeURIComponent(lead.outreachScript!.emailSubject)}&body=${encodeURIComponent(lead.outreachScript!.emailBody)}`}
                            onClick={handleContactAction}
                            className="text-xs text-zinc-950 hover:bg-orange-600 bg-orange-500 px-2.5 py-1 rounded-md flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
                          >
                            <Send className="h-3 w-3" />
                            Compose Email
                          </a>
                        </div>
                      </div>
                      <div className="p-4 space-y-3 font-mono text-xs select-text">
                        <div className="pb-2 border-b border-zinc-900 text-zinc-200">
                          <span className="font-bold text-zinc-500 font-sans">Subject:</span> {lead.outreachScript.emailSubject}
                        </div>
                        <div className="text-zinc-400 whitespace-pre-wrap leading-relaxed">
                          {lead.outreachScript.emailBody}
                        </div>
                      </div>
                    </div>

                    {/* Cold calling script */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                      <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-850 flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-zinc-500" /> Telemarketing Script
                        </span>
                        <button
                          onClick={() => copyText(lead.outreachScript!.phoneScript, 'phone')}
                          className="text-xs text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 px-2 py-1 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          {copiedPhoneScript ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          Copy Tele-Script
                        </button>
                      </div>
                      <div className="p-4 bg-orange-500/5 border-l-4 border-orange-500 italic text-zinc-300 leading-relaxed text-xs whitespace-pre-wrap select-text">
                        {lead.outreachScript.phoneScript}
                      </div>
                    </div>

                    {/* Recommended design features */}
                    <div>
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                        Recommended Website Features to Pitch:
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {lead.outreachScript.suggestedFeatures.map((item, index) => (
                          <div key={index} className="flex items-start gap-2.5 bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                            <CheckSquare className="h-4.5 w-4.5 text-orange-500 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-xs font-semibold text-white block">Feature {index + 1}</span>
                              <span className="text-xs text-zinc-400 block mt-0.5">{item}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Re-generate Pitch */}
                    <button 
                      onClick={handleGeneratePitch}
                      className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1.5 justify-end w-full cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3" /> Re-engineer Pitch Items
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Interactions logs and Activity Timeline logger */}
            {activeTab === 'timeline' && (
              <div className="space-y-6">
                {/* Logger Form */}
                <form onSubmit={handleAddLog} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
                    Log Customer Interaction / Note
                  </h4>
                  <div className="space-y-3.5">
                    {/* Log details */}
                    <textarea
                      value={logMessage}
                      onChange={(e) => setLogMessage(e.target.value)}
                      placeholder="e.g. Discussed mobile landing page with owners, scheduled visual call for next Wednesday..."
                      className="w-full text-xs p-3.5 rounded-lg border border-zinc-800 bg-zinc-900 min-h-[70px] focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-zinc-200 placeholder:text-zinc-655"
                      required
                    />

                    <div className="flex items-center justify-between gap-4">
                      {/* Log Types Buttons */}
                      <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                        {(['call', 'email', 'comment'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setLogType(type)}
                            className={`text-xs px-3 py-1 rounded-md font-medium capitalize cursor-pointer transition-all ${
                              logType === type
                                ? 'bg-orange-500 text-zinc-950 font-bold shadow-xs'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            {type === 'comment' ? 'Notes' : type}
                          </button>
                        ))}
                      </div>

                      <button
                        type="submit"
                        className="bg-white text-zinc-950 hover:bg-zinc-100 font-bold text-xs px-4.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        Log Interaction
                      </button>
                    </div>
                  </div>
                </form>

                {/* Timeline display */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Interaction History timeline
                  </h4>
                  
                  {lead.activityLog.length === 0 ? (
                    <p className="text-zinc-600 text-xs text-center py-6 italic">
                      No customer interactions logged yet. Complete calls or emails above to begin tracing leads.
                    </p>
                  ) : (
                    <div className="relative border-l border-zinc-800 pl-4 space-y-5 ml-2.5">
                      {lead.activityLog.map((log) => (
                        <div key={log.id} className="relative">
                          {/* Timeline dot icon indicator */}
                          <span className={`absolute -left-[24.5px] border-2 border-zinc-950 rounded-full p-1 shrink-0 bg-zinc-900 ${
                            log.type === 'call' ? 'text-blue-400' :
                            log.type === 'email' ? 'text-indigo-400' :
                            log.type === 'status_change' ? 'text-purple-400' :
                            'text-zinc-500'
                          }`}>
                            {log.type === 'call' && <Phone className="h-3.5 w-3.5" />}
                            {log.type === 'email' && <Mail className="h-3.5 w-3.5" />}
                            {log.type === 'status_change' && <RefreshCw className="h-3.5 w-3.5" />}
                            {log.type === 'note' && <MessageSquare className="h-3.5 w-3.5" />}
                          </span>

                          <div>
                            <span className="text-xs font-semibold text-zinc-200 block">
                              {log.title}
                            </span>
                            <span className="text-[10px] text-zinc-500 block mt-0.5">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                            <p className="text-xs text-zinc-400 mt-1 pb-1 leading-relaxed whitespace-pre-wrap select-text">
                              {log.detail}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB CONTENT: SWOT Analysis Audits */}
            {activeTab === 'analysis' && (
              !isPro ? (
                <div className="bg-zinc-950/40 border border-orange-500/10 p-6 rounded-2xl text-center space-y-4 animate-fadeIn">
                  <div className="mx-auto w-10 h-10 rounded-full bg-orange-500/15 flex items-center justify-center border border-orange-500/20">
                    <Lock className="h-4.5 w-4.5 text-orange-400" />
                  </div>
                  <h3 className="text-white text-sm font-extrabold flex items-center justify-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-orange-500" /> Unlock Advanced SWOT & SEO Estimations
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    View comprehensive competitor pricing breakdowns, potential search traffic loss calculations, local map difficulty analysis, and specific SEO optimization roadmaps.
                  </p>
                  <button
                    type="button"
                    onClick={onUpgradeClick}
                    className="bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-500/10 font-extrabold text-zinc-950 px-4 py-2 rounded-lg text-xs tracking-wide uppercase transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="h-3.5 w-3.5 fill-current" /> Start 3-day Free Trial
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-fadeIn">
                  {!lead.analysis ? (
                    <div className="bg-orange-500/5 rounded-2xl p-6 border border-orange-500/10 flex flex-col items-center text-center">
                      <div className="p-3 bg-orange-500/10 text-orange-400 rounded-full mb-3.5">
                        <BarChart2 className="h-6 w-6" />
                      </div>
                      <h3 className="font-bold text-white text-base">Generate Competitive SWOT Audit</h3>
                      <p className="text-xs text-zinc-400 max-w-md mt-1 mb-4 leading-relaxed">
                        Gather regional SEO rankings data, run traffic loss estimations, list competitor counts in {lead.city}, and prepare a localized strategic positioning plan.
                      </p>
                      <button
                        onClick={handleGenerateAnalysis}
                        disabled={loadingAnalysis}
                        className="px-5 py-2 text-xs font-bold bg-orange-500 text-zinc-950 rounded-lg shadow-sm hover:bg-orange-600 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        {loadingAnalysis ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analyzing competitor indices...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Generate SWOT Analysis
                          </>
                        )}
                      </button>
                      {analysisError && (
                        <p className="text-red-400 text-xs mt-3 bg-red-500/10 px-3 py-1.5 rounded-md border border-red-950">
                          {analysisError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      
                      {/* SEO Metrics Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl">
                          <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">Missed Traffic</span>
                          <span className="text-xs text-white font-bold block mt-1">{lead.analysis.seoMetrics.estimatedMonthlyMissedTraffic}</span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl col-span-1">
                          <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">Lost Revenue Est</span>
                          <span className="text-xs text-orange-400 font-bold block mt-1">{lead.analysis.seoMetrics.estimatedBookingLossRevenue}</span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl">
                          <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">Nearby Rivals</span>
                          <span className="text-xs text-white font-bold block mt-1">{lead.analysis.seoMetrics.competitorCount}</span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl">
                          <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">SEO Difficulty</span>
                          <span className="text-xs text-emerald-400 font-bold block mt-1">{lead.analysis.seoMetrics.rankDifficulty}</span>
                        </div>
                      </div>

                      {/* SWOT Matrix 4 Grid */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Competitive SWOT Matrix</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {/* Strengths */}
                          <div className="bg-zinc-950 border-l-4 border-emerald-500 p-4 rounded-xl border border-zinc-850/80">
                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">💪 Strengths</span>
                            <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-300 mt-2">
                              {lead.analysis.swot.strengths.map((item, idx) => <li key={idx}>{item}</li>)}
                            </ul>
                          </div>
                          {/* Weaknesses */}
                          <div className="bg-zinc-950 border-l-4 border-red-500 p-4 rounded-xl border border-zinc-850/80">
                            <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">⚠️ Weaknesses</span>
                            <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-300 mt-2">
                              {lead.analysis.swot.weaknesses.map((item, idx) => <li key={idx}>{item}</li>)}
                            </ul>
                          </div>
                          {/* Opportunities */}
                          <div className="bg-zinc-950 border-l-4 border-blue-500 p-4 rounded-xl border border-zinc-850/80">
                            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">🚀 Opportunities</span>
                            <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-300 mt-2">
                              {lead.analysis.swot.opportunities.map((item, idx) => <li key={idx}>{item}</li>)}
                            </ul>
                          </div>
                          {/* Threats */}
                          <div className="bg-zinc-950 border-l-4 border-purple-500 p-4 rounded-xl border border-zinc-850/80">
                            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">⚡ Threats</span>
                            <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-300 mt-2">
                              {lead.analysis.swot.threats.map((item, idx) => <li key={idx}>{item}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Digital strategy guidance */}
                      <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5">
                          Digital Outreach Priority Strategy
                        </h4>
                        <p className="text-xs text-zinc-300 leading-relaxed italic select-all">
                          &ldquo;{lead.analysis.digitalStrategy}&rdquo;
                        </p>
                      </div>

                      {/* Re-generate button */}
                      <button 
                        onClick={handleGenerateAnalysis}
                        className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1.5 justify-end w-full cursor-pointer mt-2"
                      >
                        <RefreshCw className="h-3 w-3" /> Re-audit Competitors
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            {/* TAB CONTENT: Sales Objections Coach AI */}
            {activeTab === 'assistant' && (
              !isPro ? (
                <div className="bg-zinc-950/40 border border-orange-500/10 p-6 rounded-2xl text-center space-y-4 animate-fadeIn">
                  <div className="mx-auto w-10 h-10 rounded-full bg-orange-500/15 flex items-center justify-center border border-orange-500/20">
                    <Lock className="h-4.5 w-4.5 text-orange-400" />
                  </div>
                  <h3 className="text-white text-sm font-extrabold flex items-center justify-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-orange-500" /> Unlock Objection Handling AI Coach
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    Obtain custom-tailored rebuttal logs from Gemini for word-of-mouth objectors, pricing resistance counters, and instant callback templates for your active negotiations.
                  </p>
                  <button
                    type="button"
                    onClick={onUpgradeClick}
                    className="bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-500/10 font-extrabold text-zinc-950 px-4 py-2 rounded-lg text-xs tracking-wide uppercase transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="h-3.5 w-3.5 fill-current" /> Start 3-day Free Trial
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-fadeIn flex flex-col h-[420px] bg-zinc-950 rounded-2xl border border-zinc-850 p-4.5">
                  
                  {/* Message Log */}
                  <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 select-text text-xs scrollbar-thin scrollbar-thumb-zinc-800">
                    {chatMessages.map((m, idx) => (
                      <div 
                        key={idx} 
                        className={`flex gap-2.5 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 h-fit ${m.role === 'user' ? 'bg-zinc-800 text-zinc-300' : 'bg-orange-500/10 border border-orange-500/20 text-orange-400'}`}>
                          {m.role === 'user' ? <UserCheck className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                        </div>
                        <div className={`p-3 rounded-2xl leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-zinc-900 border border-zinc-800 text-zinc-200' : 'bg-zinc-950 border border-zinc-850 text-zinc-300'}`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex gap-2.5 mr-auto max-w-[85%] animate-pulse">
                        <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        </div>
                        <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-850 text-zinc-500 font-mono text-[10px]">
                          Coach is strategizing objection tactics...
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input form */}
                  <form onSubmit={handleSendChatMessage} className="flex gap-2 border-t border-zinc-850 pt-3">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask the coach: 'Owner says they are too busy' or 'Draft a phone rebuttal'..."
                      className="flex-1 bg-zinc-900 text-xs text-zinc-200 placeholder:text-zinc-650 rounded-xl px-3.5 py-2.5 border border-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-orange-500/40"
                    />
                    <button
                      type="submit"
                      disabled={chatLoading || !chatInput.trim()}
                      className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-zinc-950 p-2.5 rounded-xl cursor-pointer transition-all shrink-0 active:scale-95"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              )
            )}

          </div>

          {/* RIGHT PANELS (Customer details card notes + Lead status updates) */}
          <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-5 space-y-6 self-start max-h-fit shadow-xs">
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                Lead State Controller
              </h3>
              <div className="space-y-4">
                {/* Change Status */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Lead Status
                  </label>
                  <select
                    value={lead.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as LeadStatus;
                      
                      const statusLogItem: ActivityLogItem = {
                        id: `log_status_${Date.now()}`,
                        type: 'status_change',
                        timestamp: new Date().toISOString(),
                        title: `Converted Status to: ${nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}`,
                        detail: `Pipeline state modified via lead controller.`
                      };

                      onUpdateLead({
                        ...lead,
                        status: nextStatus,
                        activityLog: [statusLogItem, ...lead.activityLog]
                      });
                    }}
                    className="w-full text-xs font-semibold bg-zinc-900 text-zinc-200 p-2.5 rounded-lg border border-zinc-800 focus:outline-hidden"
                  >
                    <option value="new">🆕 New Lead</option>
                    <option value="contacted">📞 Contact Established</option>
                    <option value="proposal">💬 Proposal / Pitch Sent</option>
                    <option value="negotiating">🤝 Direct Negotiations</option>
                    <option value="won">🎉 Account Won!</option>
                    <option value="rejected">🛑 Disqualified / Rejected</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tag Manager Module */}
            <div className="border-t border-zinc-900 pt-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-orange-500" />
                Custom Categories & Tags
              </h3>
              
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(!lead.tags || lead.tags.length === 0) ? (
                  <span className="text-[10px] text-zinc-600 italic">No tags labeled yet.</span>
                ) : (
                  lead.tags.map(tag => (
                    <span 
                      key={tag} 
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${getTagStylesSidebar(tag)}`}
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-white text-zinc-500 shrink-0 font-bold select-none cursor-pointer text-xs leading-none p-0.5"
                        title={`Remove #${tag}`}
                      >
                        &times;
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Tag Quick Presets and manual insert */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-1">
                  {['high-priority', 'follow-up', 'warm'].map(preset => {
                    const hasTag = lead.tags?.includes(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => hasTag ? handleRemoveTag(preset) : handleAddTag(preset)}
                        className={`text-[9px] font-bold tracking-tight px-2 py-0.5 rounded-md border cursor-pointer transition-colors ${
                          hasTag 
                            ? 'bg-orange-550/20 text-orange-450 border-orange-500/30'
                            : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800'
                        }`}
                      >
                        {hasTag ? '✓' : '+'} {preset}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Create category tag..."
                    id="newCustomTagInput"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim().toLowerCase();
                        if (val) {
                          handleAddTag(val);
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                    className="flex-1 bg-zinc-900 border border-zinc-800 text-xs px-2.5 py-1.5 rounded-lg text-zinc-200 placeholder:text-zinc-650 focus:outline-hidden focus:border-zinc-700"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const inputEl = document.getElementById('newCustomTagInput') as HTMLInputElement;
                      const val = inputEl?.value.trim().toLowerCase();
                      if (val) {
                        handleAddTag(val);
                        inputEl.value = '';
                      }
                    }}
                    className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 px-2.5 py-1 text-xs rounded-lg cursor-pointer transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Address Coordinate Area */}
            <div className="border-t border-zinc-900 pt-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                Geographic Location
              </h3>
              <div className="space-y-3.5 text-xs text-zinc-400">
                <div className="flex items-start gap-1.5">
                  <span className="leading-relaxed text-zinc-300 font-medium select-all">
                    {lead.address || `${lead.city}, ${lead.country}`}
                  </span>
                </div>
                
                {/* Embed OpenStreetMap / Google Maps fallback embed <iframe> */}
                <div className="relative w-full h-40 rounded-2xl border border-zinc-800/80 bg-zinc-950 overflow-hidden shadow-xs">
                  <iframe
                    title="Business Location Map"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(lead.address || `${lead.name}, ${lead.city}, ${lead.country}`)}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                    className="absolute inset-0 w-full h-full border-0 grayscale opacity-80 contrast-125 focus:outline-hidden"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                </div>
                
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address || `${lead.name}, ${lead.city}, ${lead.country}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 hover:underline font-bold transition-all"
                >
                  Configure Routes in Google Maps
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* General Discovery Notes */}
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
                Discovery Agent Notes
              </h3>
              <div className="bg-zinc-900 p-3.5 rounded-xl border border-zinc-800 text-zinc-350 leading-relaxed text-xs">
                <div className="font-semibold text-red-400 flex items-center gap-1 mb-1 bg-red-500/10 px-2 py-0.5 rounded-md w-fit">
                  Webless Issue Identifiers
                </div>
                "{lead.notes}"
              </div>
            </div>

            {/* Quick Action Dial Buttons */}
            <div className="pt-2 border-t border-zinc-800 flex gap-2">
              <a
                href={`tel:${lead.phone}`}
                onClick={handleContactAction}
                className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Phone className="h-4 w-4 text-zinc-500" />
                Call Client
              </a>
              <a
                href={lead.outreachScript ? `mailto:${lead.email}?subject=${encodeURIComponent(lead.outreachScript.emailSubject)}&body=${encodeURIComponent(lead.outreachScript.emailBody)}` : `mailto:${lead.email}`}
                onClick={handleContactAction}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-zinc-955 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Mail className="h-4 w-4" />
                {lead.outreachScript ? 'Send Pitch' : 'Send Email'}
              </a>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
