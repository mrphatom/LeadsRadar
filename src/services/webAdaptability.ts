import { BusinessLead, WebAdaptabilityCheck } from '../types';
import { apiFetch } from '../apiClient';

export async function checkWebAdaptability(lead: BusinessLead): Promise<WebAdaptabilityCheck> {
  try {
    const response = await apiFetch('/api/web-adaptability-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: lead.id,
        name: lead.name,
        city: lead.city,
        country: lead.country,
        category: lead.category,
        websiteStatus: lead.websiteStatus,
      }),
    });

    if (!response.ok) {
      throw new Error(`Web adaptability endpoint responded with status ${response.status}`);
    }

    const data = await response.json();
    if (data && data.adaptability) {
      return data.adaptability;
    }
    throw new Error('Invalid adaptability response structure.');
  } catch (err) {
    console.warn('Web adaptability provider unavailable; returning unverified state.', err);
    return getFallbackWebAdaptability(lead);
  }
}

export function getFallbackWebAdaptability(_lead: BusinessLead): WebAdaptabilityCheck {
  return {
    lastCheckedAt: new Date().toISOString(),
    status: 'Not checked',
    detectedChanges: [],
    adaptabilityScore: 0,
  };
}
