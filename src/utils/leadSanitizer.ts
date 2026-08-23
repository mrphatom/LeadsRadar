import type { BusinessLead } from '../types';

export type LeadDataQuality = 'verified' | 'provided' | 'unverified' | 'synthetic';

const MISSING_EMAIL = 'Email not publicly listed';
const MISSING_PHONE = 'No public phone number found';
const MISSING_PROFILE = 'No public profile';
const MISSING_LINKEDIN = 'LinkedIn profile not publicly listed';

function isMissingValue(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  const normalized = value.trim().toLowerCase();
  return !normalized || [
    'unlisted',
    'not publicly listed',
    'not listed',
    'not available',
    'no email',
    'no public phone number found',
    'no public phone found',
    'no public profile',
    'n/a',
    'none',
    'null',
    '[not publicly listed]',
  ].some((marker) => normalized.includes(marker));
}

export function sanitizeEmail(emailCandidate: string | undefined, _businessName = ''): string {
  if (isMissingValue(emailCandidate) || typeof emailCandidate !== 'string') return MISSING_EMAIL;
  const value = emailCandidate.trim().toLowerCase();
  if (value.includes('example.com') || value.includes('test.com') || value.endsWith('.local')) return MISSING_EMAIL;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? value : MISSING_EMAIL;
}

export function sanitizePhone(phoneCandidate: string | undefined, _city = ''): string {
  if (isMissingValue(phoneCandidate) || typeof phoneCandidate !== 'string') return MISSING_PHONE;
  const value = phoneCandidate.trim();
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 20 ? value : MISSING_PHONE;
}

export function sanitizeSocials(socialsCandidate: unknown, _businessName = ''): { facebook: string; instagram: string; twitter: string } {
  const socials = socialsCandidate && typeof socialsCandidate === 'object'
    ? socialsCandidate as Record<string, unknown>
    : {};
  const sanitizeUrl = (value: unknown): string => {
    if (isMissingValue(value) || typeof value !== 'string') return MISSING_PROFILE;
    try {
      const url = new URL(value.trim());
      return ['http:', 'https:'].includes(url.protocol) ? url.toString() : MISSING_PROFILE;
    } catch {
      return MISSING_PROFILE;
    }
  };
  return {
    facebook: sanitizeUrl(socials.facebook),
    instagram: sanitizeUrl(socials.instagram),
    twitter: sanitizeUrl(socials.twitter),
  };
}

export function sanitizeLinkedin(linkedinCandidate: string | undefined, _businessName = ''): string {
  if (isMissingValue(linkedinCandidate) || typeof linkedinCandidate !== 'string') return MISSING_LINKEDIN;
  try {
    const url = new URL(linkedinCandidate.trim());
    return url.protocol === 'https:' && url.hostname.toLowerCase().endsWith('linkedin.com')
      ? url.toString()
      : MISSING_LINKEDIN;
  } catch {
    return MISSING_LINKEDIN;
  }
}

export function sanitizeLeadContact(lead: BusinessLead): BusinessLead {
  if (!lead) return lead;

  const email = sanitizeEmail(lead.email, lead.name);
  const phone = sanitizePhone(lead.phone, lead.city);
  const socials = sanitizeSocials(lead.socials, lead.name);
  const linkedin = sanitizeLinkedin(lead.linkedin, lead.name);
  const isSynthetic = lead.dataQuality === 'synthetic' || lead.id?.startsWith('seed_') || lead.email?.toLowerCase().endsWith('.local') || lead.sourcePlatform === 'Demo generator';
  const hasMissingContact = email === MISSING_EMAIL || phone === MISSING_PHONE;
  const dataQuality: LeadDataQuality = isSynthetic
    ? 'synthetic'
    : lead.verified && !hasMissingContact
      ? 'verified'
      : hasMissingContact
        ? 'unverified'
        : 'provided';

  return {
    ...lead,
    email,
    phone,
    socials,
    linkedin,
    verified: dataQuality === 'verified',
    dataQuality,
  };
}

export function sanitizeLeadArray(leads: BusinessLead[]): BusinessLead[] {
  if (!Array.isArray(leads)) return [];
  return leads.filter(Boolean).map((lead) => sanitizeLeadContact(lead));
}
