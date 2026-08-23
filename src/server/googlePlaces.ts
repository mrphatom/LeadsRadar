import type { BusinessLead, CountryType } from '../types.ts';

const GOOGLE_PLACES_ENDPOINT = 'https://places.googleapis.com/v1';
const PROVIDER_TIMEOUT_MS = 15_000;
const MISSING_EMAIL = 'Email not publicly listed';
const MISSING_PHONE = 'No public phone number found';
const MISSING_LINKEDIN = 'LinkedIn profile not publicly listed';
const MISSING_PROFILE = 'No public profile';
const MISSING_CATEGORY = 'Category not returned by Google Places';

export const GOOGLE_PLACES_SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.businessStatus',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.internationalPhoneNumber',
  'places.nationalPhoneNumber',
  'places.primaryTypeDisplayName',
].join(',');

export const GOOGLE_PLACES_DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'businessStatus',
  'googleMapsUri',
  'websiteUri',
  'internationalPhoneNumber',
  'nationalPhoneNumber',
  'primaryTypeDisplayName',
].join(',');

export interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  businessStatus?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  primaryTypeDisplayName?: { text?: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parsePlace(value: unknown): GooglePlace | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  if (!id) return null;
  const displayName = isRecord(value.displayName) ? { text: asString(value.displayName.text) } : undefined;
  const primaryTypeDisplayName = isRecord(value.primaryTypeDisplayName)
    ? { text: asString(value.primaryTypeDisplayName.text) }
    : undefined;
  return {
    id,
    displayName,
    formattedAddress: asString(value.formattedAddress),
    businessStatus: asString(value.businessStatus),
    googleMapsUri: asString(value.googleMapsUri),
    websiteUri: asString(value.websiteUri),
    internationalPhoneNumber: asString(value.internationalPhoneNumber),
    nationalPhoneNumber: asString(value.nationalPhoneNumber),
    primaryTypeDisplayName,
  };
}

async function requestGooglePlaces(apiKey: string, input: string | URL, init: RequestInit): Promise<unknown> {
  if (!apiKey) throw new Error('Google Places API key is required.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.headers || {}),
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
    });
    if (!response.ok) {
      throw new Error(`Google Places request failed with status ${response.status}.`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function searchGooglePlaces(
  apiKey: string,
  query: string,
  pageSize = 10,
): Promise<GooglePlace[]> {
  const response = await requestGooglePlaces(
    apiKey,
    `${GOOGLE_PLACES_ENDPOINT}/places:searchText`,
    {
      method: 'POST',
      headers: { 'X-Goog-FieldMask': GOOGLE_PLACES_SEARCH_FIELD_MASK },
      body: JSON.stringify({
        textQuery: query,
        pageSize: Math.max(1, Math.min(pageSize, 20)),
        includePureServiceAreaBusinesses: false,
      }),
    },
  );
  const places = isRecord(response) && Array.isArray(response.places) ? response.places : [];
  return places.map(parsePlace).filter((place): place is GooglePlace => place !== null);
}

export async function getGooglePlaceDetails(apiKey: string, placeId: string): Promise<GooglePlace> {
  const response = await requestGooglePlaces(
    apiKey,
    `${GOOGLE_PLACES_ENDPOINT}/places/${encodeURIComponent(placeId)}`,
    {
      method: 'GET',
      headers: { 'X-Goog-FieldMask': GOOGLE_PLACES_DETAILS_FIELD_MASK },
    },
  );
  const place = parsePlace(response);
  if (!place) throw new Error('Google Places returned an invalid place record.');
  return place;
}

function safeLeadId(placeId: string): string {
  return `lead_google_${placeId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export function mapGooglePlaceToLead(
  place: GooglePlace,
  country: CountryType,
  city: string,
  category: string,
  retrievedAt: string,
): BusinessLead {
  const name = place.displayName?.text || 'Name not returned by Google Places';
  const phone = place.internationalPhoneNumber || place.nationalPhoneNumber || MISSING_PHONE;
  const websiteStatus = place.websiteUri ? 'Official website listed by Google Places' : 'No website listed by Google Places';
  const businessStatus = place.businessStatus || 'Business status not returned by Google Places';
  const sourceUrls = [place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(place.id)}`];

  return {
    id: safeLeadId(place.id),
    name,
    country,
    city,
    address: place.formattedAddress || 'Address not returned by Google Places',
    category: place.primaryTypeDisplayName?.text || MISSING_CATEGORY,
    phone,
    email: MISSING_EMAIL,
    linkedin: MISSING_LINKEDIN,
    socials: {
      facebook: MISSING_PROFILE,
      instagram: MISSING_PROFILE,
      twitter: MISSING_PROFILE,
    },
    websiteStatus,
    verified: true,
    dataQuality: 'verified',
    verificationMethod: 'google-places',
    evidenceAuthority: 'server-provider',
    verificationSummary: `Provider record retrieved from Google Places at ${retrievedAt}. Business status reported by provider: ${businessStatus}.`,
    sourcePlatform: 'Google Places API',
    sourceId: place.id,
    sourceUrls,
    retrievedAt,
    verificationScore: 0,
    status: 'new',
    notes: `Google Places returned this record for the requested ${category} search in ${city}, ${country}. Confirm current business status and contact preferences before outreach.`,
    createdAt: retrievedAt,
    activityLog: [],
  };
}

export function isOperationalOrUnspecified(place: GooglePlace): boolean {
  return place.businessStatus !== 'CLOSED_PERMANENTLY';
}

export function isExactPlaceNameMatch(place: GooglePlace, requestedName: string): boolean {
  const actual = place.displayName?.text?.trim().toLocaleLowerCase();
  const requested = requestedName.trim().toLocaleLowerCase();
  return Boolean(actual && requested && (actual === requested || actual.includes(requested) || requested.includes(actual)));
}
