export type CountryType = string;

export type LeadStatus = 'new' | 'contacted' | 'proposal' | 'negotiating' | 'won' | 'rejected';

export interface ActivityLogItem {
  id: string;
  type: 'call' | 'email' | 'note' | 'status_change';
  timestamp: string;
  detail: string;
  title: string;
}

export interface SearchHistoryItem {
  id: string;
  country: string;
  city: string;
  category: string;
  platforms: string[];
  timestamp: string;
  resultsCount: number;
}

export interface LinkedInEmployeeContact {
  name: string;
  role: string;
  profileUrl?: string;
  department?: string;
  verifiedStatus: 'Verified Active' | 'Unlisted' | 'Estimated';
}

export interface LinkedInCompanyIntelligence {
  companyName: string;
  linkedinUrl?: string;
  employeeCountRange?: string;
  industry?: string;
  verifiedSocialFootprint: boolean;
  keyDecisionMakers: LinkedInEmployeeContact[];
  lastAuditedAt: string;
  summary: string;
}

export interface WebAdaptabilityCheck {
  lastCheckedAt: string;
  status: 'Active Unchanged' | 'Web Changes Detected' | 'Domain Recently Registered' | 'Offline / Unreachable' | 'Not checked';
  httpStatus?: number;
  detectedChanges?: string[];
  adaptabilityScore: number;
}

export interface GuestUsageState {
  isGuest: boolean;
  searchesUsed: number;
  maxSearches: number;
  leadsSaved: number;
  maxLeadsSaved: number;
  auditLogs: {
    id: string;
    action: string;
    timestamp: string;
    ipHash: string;
    status: 'ALLOWED' | 'RATE_LIMITED' | 'AUDITED';
  }[];
}

export type AIPitchTone =
  | 'warm_consultant'
  | 'value_first_partner'
  | 'direct_founder'
  | 'local_neighbor'
  | 'loom_video_script'
  | 'audio_voiceover';

export interface BusinessLead {
  id: string;
  name: string;
  emailSent?: boolean;
  country: CountryType;
  city: string;
  address?: string;
  category: string;
  phone: string;
  email: string;
  linkedin?: string;
  socials?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  websiteStatus?: string;
  verified?: boolean;
  dataQuality?: 'verified' | 'provided' | 'unverified' | 'synthetic';
  verificationSummary?: string;
  sourcePlatform?: string;
  verificationScore?: number;
  status: LeadStatus;
  notes: string;
  linkedinIntelligence?: LinkedInCompanyIntelligence;
  webAdaptability?: WebAdaptabilityCheck;
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
    competitors?: {
      name: string;
      website: string;
      missedAdvantage: string;
    }[];
  };
}

export interface SearchConfig {
  country: CountryType;
  city: string;
  category: string;
  platforms?: string[];
}


