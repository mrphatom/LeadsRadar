import React, { useEffect, useState } from 'react';
import { CreditCard, ShieldCheck, ArrowLeft, Loader2, Sparkles, Building2 } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function CheckoutSandbox() {
  const { user, profile, updateUserSubscription } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paystackGatewayError, setPaystackGatewayError] = useState<string | null>(null);
  const [params, setParams] = useState({
    tier: 'pro',
    period: 'month',
    successUrl: '/',
    cancelUrl: '/'
  });

  useEffect(() => {
    // Parse query constraints
    const searchParams = new URLSearchParams(window.location.search);
    setParams({
      tier: searchParams.get('tier') || 'pro',
      period: searchParams.get('period') || 'month',
      successUrl: searchParams.get('success_url') || '/',
      cancelUrl: searchParams.get('cancel_url') || '/'
    });

    const gatewayError = searchParams.get('paystack_error');
    if (gatewayError) {
      setPaystackGatewayError(gatewayError);
    }
  }, []);

  const handleSimulatePayment = async () => {
    if (!user) {
      setCheckoutError("No signed-in user found for checkout session billing.");
      return;
    }
    setLoading(true);
    setCheckoutError(null);
    try {
      // Set trial expiration for 3 days
      const trialDate = new Date();
      trialDate.setDate(trialDate.getDate() + 3);
      
      await updateUserSubscription(
        'pro', 
        params.period as 'month' | 'year', 
        trialDate.toISOString(), 
        `mock_sub_${Date.now()}`
      );
      
      // Artificial short delay to emulate bank confirmation
      setTimeout(() => {
        window.location.href = params.successUrl;
      }, 1200);
    } catch (err: any) {
      setCheckoutError("Error logging sandbox purchase: " + err.message);
      setLoading(false);
    }
  };

  const currentPrice = params.period === 'year' ? '$64.00' : '$7.00';
  const priceInterval = params.period === 'year' ? 'yearly' : 'monthly';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center p-4 relative font-sans">
      <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-zinc-500/5 rounded-full blur-3xl" />

      <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl z-10 grid grid-cols-1 md:grid-cols-12">
        
        {/* Left Side: Order Pitch Summary */}
        <div className="md:col-span-5 bg-zinc-950 p-8 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-8">
              <div className="bg-orange-500 text-zinc-950 p-1.5 rounded-lg">
                <Building2 className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold text-white uppercase tracking-wider font-mono">LeadsRadar Pay</span>
            </div>

            <div className="space-y-3">
              <span className="text-zinc-500 font-medium text-xs uppercase tracking-widest block">Subscribe to Pro Plan</span>
              <h1 className="text-white text-3xl font-extrabold flex items-baseline gap-1.5">
                {currentPrice} <span className="text-zinc-500 text-sm font-normal">/ {params.period === 'year' ? 'year' : 'month'}</span>
              </h1>
              <div className="inline-flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-md text-[10px] font-bold text-orange-400 font-mono">
                ⭐ 3-DAY FREE TRIAL INCLUDED
              </div>
            </div>

            <div className="mt-8 space-y-4 text-xs text-zinc-400">
              <div className="flex justify-between pb-3 border-b border-zinc-850">
                <span>Outreach Pro ({priceInterval})</span>
                <span className="text-white font-medium">{currentPrice}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] bg-zinc-900 border border-zinc-800 p-3 rounded-xl gap-2 font-mono">
                <span className="text-zinc-500">Trial Period</span>
                <span className="text-orange-400 font-bold">Free for 3 days</span>
              </div>
              <div className="text-[10px] text-zinc-500">
                You will not be charged today. Your trial expires in 3 days, after which your selected payment method will be charged {currentPrice} periodically. You can cancel at any time.
              </div>
            </div>
          </div>

          <div className="mt-8">
            <a 
              href={params.cancelUrl} 
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
            </a>
          </div>
        </div>

        {/* Right Side: Credit Card Simulator form */}
        <div className="md:col-span-7 p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-extrabold text-base flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-zinc-400" /> Paystack Sandbox Checkout
              </h2>
              <div className="text-[10px] bg-zinc-850 px-2.5 py-1 rounded-lg text-zinc-400 font-semibold uppercase tracking-wider font-mono">
                Test Gateway
              </div>
            </div>

            <div className="space-y-4">
              {/* Fake Email */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Account Email</label>
                <input 
                  type="email" 
                  value={user?.email || 'user@example.com'} 
                  disabled
                  className="w-full text-xs font-mono py-2 px-3 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-500 focus:outline-hidden cursor-not-allowed" 
                />
              </div>

              {/* Fake Card Info */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Card Information</label>
                <div className="rounded-xl border border-zinc-805 bg-zinc-950 overflow-hidden divide-y divide-zinc-805">
                  <div className="flex items-center px-3 py-2.5">
                    <input 
                      type="text" 
                      placeholder="4242 4242 4242 4242" 
                      defaultValue="4242 4242 4242 4242"
                      disabled
                      className="w-full text-xs font-mono bg-transparent text-zinc-300 focus:outline-hidden"
                    />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold ml-2 font-mono">Visa</span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-zinc-805">
                    <input 
                      type="text" 
                      placeholder="MM / YY" 
                      defaultValue="12 / 29"
                      disabled
                      className="text-xs font-mono py-2 px-3 bg-transparent text-zinc-300 focus:outline-hidden"
                    />
                    <input 
                      type="text" 
                      placeholder="CVC" 
                      defaultValue="123"
                      disabled
                      className="text-xs font-mono py-2 px-3 bg-transparent text-zinc-300 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Name on card */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Cardholder Name</label>
                <input 
                  type="text" 
                  defaultValue={user?.displayName || 'Outreach Member'} 
                  disabled
                  className="w-full text-xs py-2 px-3 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 focus:outline-hidden" 
                />
              </div>
            </div>

            {paystackGatewayError && (
              <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl mt-5">
                <p className="text-xs text-amber-500 font-bold mb-1 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  ⚠️ Paystack Gateway Warning
                </p>
                <div className="text-[11px] text-zinc-400 leading-relaxed font-mono">
                  <span>Your live/test Paystack API returned a configuration message:</span>
                  <span className="text-amber-400 block mt-1 bg-zinc-950 p-2 rounded-lg border border-zinc-850 select-text font-mono break-words">{paystackGatewayError}</span>
                  <span className="block mt-2 text-zinc-500 text-[10px]">
                    To resolve this, make sure payment channels (e.g., Card, USSD, Bank Transfer) are enabled for your currency in your Paystack Dashboard (Settings &rarr; Preferences). We have safely loaded Sandbox Checkout so you can continue testing seamlessly!
                  </span>
                </div>
              </div>
            )}

            <div className="bg-zinc-950/50 border border-zinc-805 rounded-2xl p-4 mt-6">
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                ℹ️ **Simulation Info**: This checkout request is using the Webless Leads Sandbox flow since Paystack Secret Key is operated in Preview fallback. Clicking **Start 3-day Free Trial & Subscribe** below will securely update your account in Firestore to the Premium Tier.
              </p>
            </div>
          </div>

          <div className="mt-8">
            {checkoutError && (
              <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-rose-500 rounded-full animate-ping shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}
            <button
              onClick={handleSimulatePayment}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-zinc-950 disabled:opacity-50 py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-orange-500/10 active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying with Paystack Gateway...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4.5 w-4.5 text-zinc-950" /> Start 3-day Free Trial & Subscribe
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
