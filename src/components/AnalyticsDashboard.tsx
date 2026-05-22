import { BusinessLead } from '../types';
import { Target, CheckCircle, BarChart3, AlertCircle, PhoneIncoming, Trophy } from 'lucide-react';

interface AnalyticsDashboardProps {
  leads: BusinessLead[];
}

export default function AnalyticsDashboard({ leads }: AnalyticsDashboardProps) {
  const totalLeads = leads.length;
  
  // Calculate specific statuses
  const contactedLeads = leads.filter(l => 
    l.status === 'contacted' || 
    l.status === 'proposal' || 
    l.status === 'negotiating' || 
    l.status === 'won'
  ).length;

  const wonLeads = leads.filter(l => l.status === 'won').length;
  const negotiatingLeads = leads.filter(l => l.status === 'negotiating').length;
  const proposalLeads = leads.filter(l => l.status === 'proposal').length;
  const rejectedLeads = leads.filter(l => l.status === 'rejected').length;
  const newLeads = leads.filter(l => l.status === 'new').length;

  // Outreach Metrics
  const contactedRate = totalLeads ? Math.round((contactedLeads / totalLeads) * 100) : 0;
  const winRate = contactedLeads ? Math.round((wonLeads / contactedLeads) * 100) : 0;

  // Country Breakdown
  const countryCounts = leads.reduce((acc, lead) => {
    acc[lead.country] = (acc[lead.country] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const countries = ['USA', 'UK', 'Germany', 'Canada'];

  return (
    <div className="space-y-6 mb-8">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Prospects */}
        <div className="bg-zinc-900/50 p-5 rounded-3xl border border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Total Prospects</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-white mt-1 block">{totalLeads}</span>
          </div>
          <div className="p-3 bg-zinc-950 rounded-xl text-orange-400">
            <Target className="h-5 w-5" />
          </div>
        </div>

        {/* Contacted outreach */}
        <div className="bg-zinc-900/50 p-5 rounded-3xl border border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Contacted Leads</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-white mt-1 block">
              {contactedLeads} <span className="text-xs font-medium text-zinc-500">({contactedRate}%)</span>
            </span>
          </div>
          <div className="p-3 bg-zinc-950 rounded-xl text-blue-400">
            <PhoneIncoming className="h-5 w-5" />
          </div>
        </div>

        {/* Closed Won count */}
        <div className="bg-zinc-900/50 p-5 rounded-3xl border border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Closed Won</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-emerald-400 mt-1 block">
              {wonLeads} <span className="text-xs font-medium text-zinc-500">({winRate}% Win)</span>
            </span>
          </div>
          <div className="p-3 bg-zinc-950 rounded-xl text-emerald-400">
            <Trophy className="h-5 w-5" />
          </div>
        </div>

        {/* Missing Website Ratio */}
        <div className="bg-zinc-900/50 p-5 rounded-3xl border border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">Webless Ratio</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-indigo-400 mt-1 block">100%</span>
          </div>
          <div className="p-3 bg-zinc-950 rounded-xl text-indigo-400">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Structured visual breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deal pipeline status meter */}
        <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-orange-500" /> Pipeline Conversions
          </h3>
          <div className="space-y-4">
            {/* New */}
            <div>
              <div className="flex justify-between items-center text-xs text-zinc-400 mb-1">
                <span className="font-medium">Raw Prospects (New)</span>
                <span className="font-mono font-bold">{newLeads}</span>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-zinc-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${totalLeads ? (newLeads / totalLeads) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Contacted */}
            <div>
              <div className="flex justify-between items-center text-xs text-zinc-400 mb-1">
                <span className="font-medium text-blue-400">First Contact Initiated</span>
                <span className="font-mono font-bold">{leads.filter(l => l.status === 'contacted').length}</span>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${totalLeads ? (leads.filter(l => l.status === 'contacted').length / totalLeads) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Proposal / Pitched */}
            <div>
              <div className="flex justify-between items-center text-xs text-zinc-400 mb-1">
                <span className="font-medium text-indigo-400">Proposal & Mockup Sent</span>
                <span className="font-mono font-bold">{proposalLeads}</span>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${totalLeads ? (proposalLeads / totalLeads) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Negotiating */}
            <div>
              <div className="flex justify-between items-center text-xs text-zinc-400 mb-1">
                <span className="font-medium text-orange-400">Active Negotiation</span>
                <span className="font-mono font-bold">{negotiatingLeads}</span>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-orange-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${totalLeads ? (negotiatingLeads / totalLeads) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Won */}
            <div>
              <div className="flex justify-between items-center text-xs text-zinc-400 mb-1">
                <span className="font-medium text-emerald-400">Deal Closed (Won!)</span>
                <span className="font-mono font-bold text-emerald-400">{wonLeads}</span>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${totalLeads ? (wonLeads / totalLeads) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Lead Density by country */}
        <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-orange-500" /> Geographic Territory Distribution
          </h3>
          <div className="space-y-4">
            {countries.map(c => {
              const count = countryCounts[c] || 0;
              const percentage = totalLeads ? Math.round((count / totalLeads) * 100) : 0;
              return (
                <div key={c}>
                  <div className="flex justify-between items-center text-xs text-zinc-400 mb-1">
                    <span className="font-medium text-zinc-300">{c === 'USA' ? 'United States' : c === 'UK' ? 'United Kingdom' : c}</span>
                    <span className="font-mono font-bold">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden flex">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        c === 'USA' ? 'bg-orange-500' :
                        c === 'UK' ? 'bg-indigo-400' :
                        c === 'Germany' ? 'bg-amber-500' : 'bg-red-500'
                      }`} 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
