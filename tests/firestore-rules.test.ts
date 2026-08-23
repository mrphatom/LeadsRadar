import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const emulatorConfigured = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let testEnv: RulesTestEnvironment | undefined;

const userProfile = (uid: string) => ({
  uid,
  email: `${uid}@example.org`,
  displayName: 'Test User',
  subscriptionTier: 'free',
  subscriptionPeriod: 'none',
  subscriptionId: '',
  createdAt: '2026-08-23T00:00:00.000Z',
  gmailConnected: false,
  gmailEmail: '',
});

const lead = (ownerId: string) => ({
  id: 'lead_1',
  ownerId,
  name: 'Example Business',
  country: 'USA',
  city: 'Austin',
  category: 'Bakery',
  phone: 'No public phone number found',
  email: 'Email not publicly listed',
  status: 'new',
  createdAt: '2026-08-23T00:00:00.000Z',
  activityLog: [],
  dataQuality: 'unverified',
  verified: false,
});

test('Firestore rules enforce owner isolation and server-owned profile fields', {
  skip: !emulatorConfigured,
}, async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-leadsradar',
    firestore: {
      rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });

  const owner = testEnv.authenticatedContext('user-a').firestore();
  const otherUser = testEnv.authenticatedContext('user-b').firestore();
  const profileRef = doc(owner, 'users/user-a');

  await assertSucceeds(setDoc(profileRef, userProfile('user-a')));
  await assertSucceeds(getDoc(profileRef));
  await assertFails(getDoc(doc(otherUser, 'users/user-a')));
  await assertSucceeds(updateDoc(profileRef, { displayName: 'Updated Name' }));
  await assertFails(updateDoc(profileRef, { subscriptionTier: 'pro' }));
});

test('Firestore rules enforce lead ownership, immutable identity, and strict keys', {
  skip: !emulatorConfigured,
}, async () => {
  if (!testEnv) {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-leadsradar',
      firestore: {
        rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
      },
    });
  }

  const owner = testEnv.authenticatedContext('user-a').firestore();
  const otherUser = testEnv.authenticatedContext('user-b').firestore();
  const leadRef = doc(owner, 'leads/lead_1');

  await assertSucceeds(setDoc(leadRef, lead('user-a')));
  await assertSucceeds(getDoc(leadRef));
  await assertFails(getDoc(doc(otherUser, 'leads/lead_1')));
  await assertFails(updateDoc(leadRef, { ownerId: 'user-b' }));
  await assertFails(updateDoc(leadRef, { unexpectedPrivilege: true }));
});

test.after(async () => {
  await testEnv?.cleanup();
});
