import { BusinessLead, LeadStatus } from '../types';
import { Phone, Mail, MapPin, ClipboardList, Send, Copy, Check, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';

interface LeadCardProps {
  key?: string;
  lead: BusinessLead;
  onSelect: (lead: BusinessLead) => void;
  onStatusChange: (leadId: string, newStatus: LeadStatus) => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

const statusThemes: Record<LeadStatus, { label: string; bg: string; text: string; dot: string; cardBorder: string; cardBg: string }> = {
  new: { 
    label: 'New Lead', 
    bg: 'bg-zinc-800/80', 
    text: 'text-zinc-300', 
    dot: 'bg-zinc-500',
    cardBorder: 'rgba(63, 63, 70, 0.4)', // zinc-700 equivalent soft
    cardBg: 'rgba(24, 24, 27, 0.5)' // zinc-950/50 equivalent
  },
  contacted: { 
    label: 'Contacted', 
    bg: 'bg-blue-500/10', 
    text: 'text-blue-400', 
    dot: 'bg-blue-400',
    cardBorder: 'rgba(59, 130, 246, 0.25)', 
    cardBg: 'rgba(29, 78, 216, 0.04)' 
  },
  proposal: { 
    label: 'Proposal Sent', 
    bg: 'bg-indigo-500/10', 
    text: 'text-indigo-400', 
    dot: 'bg-indigo-400',
    cardBorder: 'rgba(99, 102, 241, 0.25)', 
    cardBg: 'rgba(67, 56, 202, 0.04)' 
  },
  negotiating: { 
    label: 'Negotiating', 
    bg: 'bg-orange-500/10', 
    text: 'text-orange-400', 
    dot: 'bg-orange-400',
    cardBorder: 'rgba(249, 115, 22, 0.25)', 
    cardBg: 'rgba(194, 65, 12, 0.04)' 
  },
  won: { 
    label: 'Deal Won', 
    bg: 'bg-emerald-500/10', 
    text: 'text-emerald-400', 
    dot: 'bg-emerald-400',
    cardBorder: 'rgba(16, 185, 129, 0.25)', 
    cardBg: 'rgba(4, 120, 87, 0.04)' 
  },
  rejected: { 
    label: 'Rejected', 
    bg: 'bg-rose-500/10', 
    text: 'text-rose-400', 
    dot: 'bg-rose-400',
    cardBorder: 'rgba(244, 63, 94, 0.25)', 
    cardBg: 'rgba(190, 24, 74, 0.04)' 
  },
};

export default function LeadCard({ lead, onSelect, onStatusChange, isSelected = false, onToggleSelect }: LeadCardProps) {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleContactAction = () => {
    if (lead.status === 'new') {
      onStatusChange(lead.id, 'contacted');
    }
  };

  const copyToClipboard = (text: string, type: 'phone' | 'email') => {
    navigator.clipboard.writeText(text);
    if (type === 'phone') {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
    handleContactAction();
  };

  const currentTheme = statusThemes[lead.status] || statusThemes.new;

  // Helper to color-code user tags beautifully
  const getTagStyles = (tag: string) => {
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

  return (
    <div 
      style={{
        borderColor: isSelected ? 'rgba(249, 115, 22, 0.6)' : currentTheme.cardBorder,
        backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.03)' : currentTheme.cardBg,
      }}
      className={`rounded-3xl border p-5 flex flex-col justify-between group shadow-sm transition-all duration-300 ease-out hover:scale-[1.015] active:scale-100 relative ${
        isSelected ? 'ring-1 ring-orange-500/30' : 'hover:border-zinc-700/80'
      }`}
    >
      <div>
        {/* Header (Status, Checkbox, Country) */}
        <div className="flex justify-between items-start gap-2 mb-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect?.()}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-zinc-750 bg-zinc-950 text-orange-500 focus:ring-orange-500/20 focus:ring-offset-zinc-950 cursor-pointer accent-orange-500"
            />
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${currentTheme.bg} ${currentTheme.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${currentTheme.dot}`} />
              {currentTheme.label}
            </span>
          </div>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-mono shrink-0 flex items-center gap-1">
            <span className="text-base select-none">
              {lead.country === 'USA' ? '🇺🇸' : lead.country === 'UK' ? '🇬🇧' : lead.country === 'Germany' ? '🇩🇪' : '🇨🇦'}
            </span>
            {lead.country}
          </span>
        </div>

        {/* Business Title & Category */}
        <h3 className="font-bold text-white text-base md:text-lg group-hover:text-orange-400 transition-colors tracking-tight line-clamp-1">
          {lead.name}
        </h3>
        
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-orange-400 font-semibold bg-orange-500/10 px-2 py-0.5 rounded-md w-fit">
            {lead.category}
          </div>

          {/* Inline Active Tags Lists */}
          {lead.tags && lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {lead.tags.map(tag => (
                <span 
                  key={tag} 
                  className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border ${getTagStyles(tag)}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Location */}
        <div className="flex items-start gap-1 text-xs text-zinc-400 mt-3">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-500 mt-0.5" />
          <span className="line-clamp-2">{lead.address || `${lead.city}, ${lead.country}`}</span>
        </div>

        {/* Challenges/Notes pitch summary */}
        <p className="text-xs text-zinc-400 mt-3 line-clamp-2 italic bg-zinc-950 p-2.5 rounded-xl border border-zinc-900 leading-relaxed">
          "{lead.notes}"
        </p>
      </div>

      <div className="mt-5 pt-4 border-t border-zinc-850 space-y-3.5">
        {/* Detail info: Dial or Email */}
        <div className="space-y-2">
          {/* Phone row */}
          <div className="flex items-center justify-between text-xs text-zinc-400 hover:text-white transition-all">
            <div 
              className="flex items-center gap-2 truncate cursor-pointer hover:underline decoration-orange-500/40"
              onClick={() => copyToClipboard(lead.phone, 'phone')}
              title="Click to copy phone & set Contacted"
            >
              <Phone className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
              <span className="font-mono truncate select-all">{lead.phone}</span>
            </div>
            <button
              onClick={() => copyToClipboard(lead.phone, 'phone')}
              className="text-zinc-500 hover:text-orange-400 p-1 shrink-0 transition-colors cursor-pointer"
              title="Copy Phone & set Contacted"
            >
              {copiedPhone ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Email row */}
          <div className="flex items-center justify-between text-xs text-zinc-400 hover:text-white transition-all">
            <div 
              className="flex items-center gap-2 truncate cursor-pointer hover:underline decoration-orange-500/40"
              onClick={() => copyToClipboard(lead.email, 'email')}
              title="Click to copy email & set Contacted"
            >
              <Mail className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
              <span className="truncate font-mono select-all">{lead.email}</span>
            </div>
            <button
              onClick={() => copyToClipboard(lead.email, 'email')}
              className="text-zinc-500 hover:text-orange-400 p-1 shrink-0 transition-colors cursor-pointer"
              title="Copy Email & set Contacted"
            >
              {copiedEmail ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-2.5">
          {/* Direct status selection switcher */}
          <select
            value={lead.status}
            onChange={(e) => onStatusChange(lead.id, e.target.value as LeadStatus)}
            className="text-xs bg-zinc-950 text-zinc-350 font-medium py-1.5 px-2 rounded-lg border border-zinc-800 focus:outline-hidden hover:bg-zinc-900 w-full transition-colors"
          >
            <option value="new">🆕 New Lead</option>
            <option value="contacted">📞 Contacted</option>
            <option value="proposal">💬 Pitched</option>
            <option value="negotiating">🤝 Negotiating</option>
            <option value="won">🎉 Closed Won</option>
            <option value="rejected">🛑 Rejected</option>
          </select>

          {/* Dual buttons row: Quick Call and Outreach AI */}
          <div className="flex items-center gap-2 w-full">
            <a 
              href={`tel:${lead.phone}`}
              onClick={handleContactAction}
              className="bg-zinc-950 hover:bg-zinc-900 hover:border-zinc-700 text-orange-400 border border-zinc-800 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 flex-1 transition-colors cursor-pointer"
              title={`Quick Call ${lead.phone}`}
            >
              <Phone className="h-3.5 w-3.5 shrink-0 text-orange-400/80" />
              <span>Quick Call</span>
            </a>
            <button
              onClick={() => onSelect(lead)}
              className="bg-orange-500 hover:bg-orange-600 text-zinc-950 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              Outreach AI
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
