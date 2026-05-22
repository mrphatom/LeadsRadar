export type CountryType = string;

export type LeadStatus = 'new' | 'contacted' | 'proposal' | 'negotiating' | 'won' | 'rejected';

export interface ActivityLogItem {
  id: string;
  type: 'call' | 'email' | 'note' | 'status_change';
  timestamp: string;
  detail: string;
  title: string;
}

export interface BusinessLead {
  id: string;
  name: string;
  country: CountryType;
  city: string;
  address?: string;
  category: string;
  phone: string;
  email: string;
  status: LeadStatus;
  notes: string;
  outreachScript?: {
    emailSubject: string;
    emailBody: string;
    phoneScript: string;
    valueProposition: string;
    suggestedFeatures: string[];
  };
  outreachScriptSource?: string;
  createdAt: string;
  activityLog: ActivityLogItem[];
  tags?: string[];
  analysis?: {
    swot: {
      strengths: string[];
      weaknesses: string[];
      opportunities: string[];
      threats: string[];
    };
    seoMetrics: {
      estimatedMonthlyMissedTraffic: string;
      estimatedBookingLossRevenue: string;
      competitorCount: string;
      rankDifficulty: string;
    };
    digitalStrategy: string;
  };
}

export interface SearchConfig {
  country: CountryType;
  city: string;
  category: string;
}
