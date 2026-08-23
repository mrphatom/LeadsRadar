import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GOOGLE_PLACES_DETAILS_FIELD_MASK,
  GOOGLE_PLACES_SEARCH_FIELD_MASK,
  isExactPlaceNameMatch,
  isOperationalOrUnspecified,
  mapGooglePlaceToLead,
  searchGooglePlaces,
} from '../src/server/googlePlaces.ts';

const place = {
  id: 'ChIJrealplace123',
  displayName: { text: 'Real Plumbing Co.' },
  formattedAddress: '10 Main Street, Austin, TX',
  businessStatus: 'OPERATIONAL',
  googleMapsUri: 'https://maps.google.com/?cid=123',
  websiteUri: undefined,
  internationalPhoneNumber: '+15125550123',
  primaryTypeDisplayName: { text: 'Plumber' },
};

test('maps a structured place without inventing unavailable contact fields', () => {
  const lead = mapGooglePlaceToLead(place, 'USA', 'Austin', 'Plumbing', '2026-08-23T00:00:00.000Z');
  assert.equal(lead.id, 'lead_google_ChIJrealplace123');
  assert.equal(lead.name, 'Real Plumbing Co.');
  assert.equal(lead.address, '10 Main Street, Austin, TX');
  assert.equal(lead.phone, '+15125550123');
  assert.equal(lead.email, 'Email not publicly listed');
  assert.equal(lead.linkedin, 'LinkedIn profile not publicly listed');
  assert.equal(lead.socials?.facebook, 'No public profile');
  assert.equal(lead.dataQuality, 'verified');
  assert.equal(lead.verificationMethod, 'google-places');
  assert.equal(lead.sourceId, 'ChIJrealplace123');
  assert.deepEqual(lead.sourceUrls, ['https://maps.google.com/?cid=123']);
  assert.equal(lead.retrievedAt, '2026-08-23T00:00:00.000Z');
});

test('does not treat permanently closed places as eligible', () => {
  assert.equal(isOperationalOrUnspecified({ ...place, businessStatus: 'CLOSED_PERMANENTLY' }), false);
  assert.equal(isOperationalOrUnspecified(place), true);
  assert.equal(isExactPlaceNameMatch(place, 'Real Plumbing Co.'), true);
  assert.equal(isExactPlaceNameMatch(place, 'Unrelated Company'), false);
});

test('uses a required, narrow production field mask and rejects non-success responses', async () => {
  assert.match(GOOGLE_PLACES_SEARCH_FIELD_MASK, /places\.id/);
  assert.match(GOOGLE_PLACES_SEARCH_FIELD_MASK, /places\.websiteUri/);
  assert.match(GOOGLE_PLACES_DETAILS_FIELD_MASK, /websiteUri/);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ places: [place] }), { status: 200 });
  try {
    const places = await searchGooglePlaces('server-only-test-key', 'Plumbing in Austin, USA', 10);
    assert.equal(places.length, 1);
    assert.equal(places[0].id, place.id);
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'provider failure' }), { status: 503 });
  try {
    await assert.rejects(() => searchGooglePlaces('server-only-test-key', 'Plumbing in Austin, USA'), /status 503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
