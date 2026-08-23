export interface MoonPayCompletedTransaction {
  id?: unknown;
  status?: unknown;
  walletAddress?: unknown;
  externalTransactionId?: unknown;
}

export interface MoonPayOrderRecord {
  uid: string;
  period: 'month' | 'year';
  status: 'pending' | 'completed';
  provider: 'moonpay';
}

export async function fulfillMoonPaySubscription(
  db: any,
  orderId: string,
  transactionData: MoonPayCompletedTransaction,
  treasuryWalletAddress: string,
  now = new Date(),
): Promise<'fulfilled' | 'already_fulfilled' | 'ignored'> {
  if (transactionData.status !== 'completed') return 'ignored';
  if (!db) throw new Error('Firestore server is not configured.');
  if (!orderId || !treasuryWalletAddress) return 'ignored';
  if (typeof transactionData.walletAddress !== 'string'
    || transactionData.walletAddress.toLowerCase() !== treasuryWalletAddress.toLowerCase()) {
    return 'ignored';
  }

  const orderRef = db.collection('moonpayOrders').doc(orderId);
  const transactionId = typeof transactionData.id === 'string' ? transactionData.id : orderId;

  return db.runTransaction(async (transaction: any) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) return 'ignored';
    const order = orderSnapshot.data() as Partial<MoonPayOrderRecord>;
    if (order.provider !== 'moonpay' || typeof order.uid !== 'string' || !['month', 'year'].includes(order.period || '')) {
      return 'ignored';
    }
    if (order.status === 'completed') return 'already_fulfilled';

    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + (order.period === 'year' ? 365 : 30));
    const userRef = db.collection('users').doc(order.uid);
    transaction.set(orderRef, {
      status: 'completed',
      providerTransactionId: transactionId,
      completedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }, { merge: true });
    transaction.set(userRef, {
      subscriptionTier: 'pro',
      subscriptionPeriod: order.period,
      subscriptionId: transactionId,
      lastPaymentReference: transactionId,
      trialExpires: expiresAt.toISOString(),
      subscriptionSource: 'moonpay',
      updatedAt: now.toISOString(),
    }, { merge: true });
    return 'fulfilled';
  });
}
