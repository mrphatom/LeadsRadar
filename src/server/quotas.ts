import { isProSubscriptionActive } from './subscription.ts';

export type SearchQuotaTier = 'free' | 'pro';

export interface SearchQuotaResult {
  allowed: boolean;
  tier: SearchQuotaTier;
  used: number;
  limit: number;
  remaining: number;
  day: string;
}

const SEARCH_LIMITS: Record<SearchQuotaTier, number> = {
  free: 10,
  pro: 20,
};

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function consumeDailySearchQuota(db: any, uid: string, now = new Date()): Promise<SearchQuotaResult> {
  const userSnapshot = await db.collection('users').doc(uid).get();
  const tier: SearchQuotaTier = isProSubscriptionActive(userSnapshot.data(), now) ? 'pro' : 'free';
  const limit = SEARCH_LIMITS[tier];
  const day = utcDay(now);
  const usageRef = db.collection('usage').doc(`${uid}_${day}`);

  return db.runTransaction(async (transaction: any) => {
    const usageSnapshot = await transaction.get(usageRef);
    const currentUsed = Number(usageSnapshot.data()?.searches ?? 0);
    const used = Number.isFinite(currentUsed) && currentUsed >= 0 ? Math.floor(currentUsed) : 0;

    if (used >= limit) {
      return {
        allowed: false,
        tier,
        used,
        limit,
        remaining: 0,
        day,
      };
    }

    const nextUsed = used + 1;
    transaction.set(usageRef, {
      uid,
      day,
      searches: nextUsed,
      updatedAt: now.toISOString(),
    }, { merge: true });

    return {
      allowed: true,
      tier,
      used: nextUsed,
      limit,
      remaining: limit - nextUsed,
      day,
    };
  });
}

export async function releaseDailySearchQuota(db: any, uid: string, day: string): Promise<void> {
  const usageRef = db.collection('usage').doc(`${uid}_${day}`);
  await db.runTransaction(async (transaction: any) => {
    const usageSnapshot = await transaction.get(usageRef);
    if (!usageSnapshot.exists) return;
    const currentUsed = Number(usageSnapshot.data()?.searches ?? 0);
    const used = Number.isFinite(currentUsed) && currentUsed > 0 ? Math.floor(currentUsed) : 0;
    if (used === 0) return;
    transaction.set(usageRef, {
      searches: used - 1,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
}
