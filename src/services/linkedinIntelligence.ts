import { LinkedInCompanyIntelligence } from '../types';
import { apiFetch } from '../apiClient';

export async function fetchLinkedInIntelligence(
  leadName: string,
  city: string,
  country: string,
  category: string
): Promise<LinkedInCompanyIntelligence> {
  try {
    const response = await apiFetch('/api/linkedin-intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: leadName,
        city,
        country,
        category,
      }),
    });

    if (!response.ok) {
      throw new Error(`LinkedIn Intelligence API responded with status: ${response.status}`);
    }

    const data = await response.json();
    if (data && data.companyIntelligence) {
      return data.companyIntelligence;
    }
    throw new Error('Invalid response structure from LinkedIn Intelligence endpoint.');
  } catch (error) {
    console.warn('LinkedIn intelligence provider unavailable; returning unverified state.', error instanceof Error ? error.name : 'UnknownError');
    return getFallbackLinkedInIntelligence(leadName, city, category);
  }
}

export function getFallbackLinkedInIntelligence(
  companyName: string,
  _city: string,
  category: string
): LinkedInCompanyIntelligence {
  return {
    companyName: companyName.trim() || 'Unidentified business',
    employeeCountRange: 'Not publicly listed',
    industry: category || 'Not publicly listed',
    verifiedSocialFootprint: false,
    keyDecisionMakers: [],
    lastAuditedAt: new Date().toISOString(),
    summary: 'LinkedIn data is unavailable because no evidence-returning LinkedIn provider is configured.',
    status: 'unavailable',
    source: 'not-configured',
  };
}
