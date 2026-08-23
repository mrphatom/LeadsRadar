import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeEmail, sanitizeLeadContact, sanitizePhone } from '../src/utils/leadSanitizer.ts';

test('preserves missing email and phone as explicit unverified markers', () => {
  assert.equal(sanitizeEmail('Email not publicly listed', 'Example Business'), 'Email not publicly listed');
  assert.equal(sanitizeEmail(undefined, 'Example Business'), 'Email not publicly listed');
  assert.equal(sanitizePhone('+1 (555) 019-2834'), '+1 (555) 019-2834');
  assert.equal(sanitizePhone('No public phone number found'), 'No public phone number found');
});

test('does not fabricate social or LinkedIn URLs', () => {
  const result = sanitizeLeadContact({
    id: 'lead_123',
    name: 'Example Business',
    country: 'USA',
    city: 'Austin',
    category: 'Bakery',
    phone: 'No public phone number found',
    email: 'Email not publicly listed',
    linkedin: 'LinkedIn profile not publicly listed',
    socials: { facebook: 'Not publicly listed' },
    status: 'new',
    notes: '',
    createdAt: new Date().toISOString(),
    activityLog: [],
    verified: true,
  });

  assert.equal(result.linkedin, 'LinkedIn profile not publicly listed');
  assert.equal(result.socials?.facebook, 'No public profile');
  assert.equal(result.verified, false);
  assert.equal(result.dataQuality, 'unverified');
});

test('marks local seed contacts as synthetic even when fields look complete', () => {
  const result = sanitizeLeadContact({
    id: 'seed_lead_1_user_1',
    name: 'Seed Business',
    country: 'USA',
    city: 'Austin',
    category: 'Bakery',
    phone: '+1 (512) 555-0100',
    email: 'info@example.local',
    status: 'new',
    notes: '',
    createdAt: new Date().toISOString(),
    activityLog: [],
    verified: true,
  });

  assert.equal(result.verified, false);
  assert.equal(result.dataQuality, 'synthetic');
});
