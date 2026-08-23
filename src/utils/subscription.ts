export function isProSubscriptionActive(profile: unknown, now = new Date()): boolean {
  if (!profile || typeof profile !== 'object') return false;

  const candidate = profile as Record<string, unknown>;
  if (candidate.subscriptionTier !== 'pro') return false;

  // Legacy/admin-provisioned Pro records may not carry an expiry. MoonPay-issued
  // records always do, and any present expiry must be valid and in the future.
  if (candidate.trialExpires === undefined || candidate.trialExpires === null || candidate.trialExpires === '') {
    return true;
  }
  if (typeof candidate.trialExpires !== 'string') return false;

  const expiresAt = Date.parse(candidate.trialExpires);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}
