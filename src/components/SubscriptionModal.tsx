import React, { useState } from 'react';
import { X, CheckCircle2, Sparkles, Loader2, ArrowRightLeft, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SubscriptionModal({ isOpen, onClose }: SubscriptionModalProps) {
  const { user, profile } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const successUrl = `${window.location.protocol}//${window.location.host}/billing-success`;
      const cancelUrl = `${window.location.protocol}//${window.location.host}/`;

      const response = await fetch('/api/paystack/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: 'pro',
          period: selectedPeriod,
          successUrl,
          cancelUrl,
          email: user?.email || "billing@leadsradar.local"
        })
      });

      if (!response.ok) {
        throw new Error('Failed to bootstrap checkout session.');
      }

      const data = await response.json();
      if (data.url) {
        // Redirect to Paystack checkout (or sandbox URL)
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned from payment server.');
      }
    } catch (err: any) {
      console.error("Paystack gateway creation failed:", err);
      setError(err.message || "Unable to reach Paystack Gateway. Please try again.");
      setLoading(false);
    }
  };

  const isPro = profile?.subscriptionTier === 'pro';

  return (
    <div className="fixed inset-0 bg-zinc-950/95 flex items-center justify-center p-4 z-55 overflow-y-auto w-full">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden max-h-[90vh]">
        
        {/* Decorative corner glows */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-zinc-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header section */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-1.5 font-bold text-orange-400 text-xs uppercase tracking-wider font-mono">
            <Sparkles className="h-4 w-4 text-orange-500 animate-pulse" /> Upgrade to LeadsRadar Premium
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-550 hover:text-white p-1 rounded-lg bg-zinc-950/40 hover:bg-zinc-950 transition-all cursor-pointer border border-zinc-805"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isPro ? (
          <div className="text-center py-6 space-y-4">
            <div className="bg-orange-500/15 border border-orange-500/25 p-4 rounded-2xl max-w-xs mx-auto text-orange-400 text-sm font-bold flex items-center justify-center gap-2">
              <Zap className="h-5 w-5 fill-orange-500 text-orange-500" /> Active Pro Account Subscription
            </div>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              Your account is successfully subscribed to the **LeadsRadar Pro Tier**. You enjoy unlimited search capability (20 queries daily), SEO analytics dashboards, SWOT competitor audits, and live sales coach chatbot triggers!
            </p>
            <div className="mt-4 pt-4 border-t border-zinc-850 text-[10px] text-zinc-500 font-mono">
              Subscription ID: <span className="text-zinc-400">{profile?.subscriptionId || 'Active trial session'}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center md:text-left">
              <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                Unlock LeadsRadar Pro
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Equip yourself with Gemini AI automation to hunt & win high-ticket B2B local accounts easily.
              </p>
            </div>

            {/* Price Plan Toggle */}
            <div className="grid grid-cols-2 gap-2.5 p-1 bg-zinc-950/80 border border-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedPeriod('month')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex flex-col items-center justify-center ${
                  selectedPeriod === 'month'
                    ? 'bg-orange-500 text-zinc-950 shadow-xs'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900 bg-transparent'
                }`}
              >
                <span>Monthly Plan</span>
                <span className={selectedPeriod === 'month' ? 'text-[9px] text-zinc-900 font-bold' : 'text-[9px] text-zinc-500 font-mono'}>$7.00/mo</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPeriod('year')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex flex-col items-center justify-center relative ${
                  selectedPeriod === 'year'
                    ? 'bg-orange-500 text-zinc-950 shadow-xs'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900 bg-transparent'
                }`}
              >
                <span className="absolute -top-2 px-1.5 py-0.5 bg-green-500 text-zinc-950 rounded-md text-[8px] font-extrabold tracking-tight uppercase shadow-sm">
                  Save 24%
                </span>
                <span>Annual Plan</span>
                <span className={selectedPeriod === 'year' ? 'text-[9px] text-zinc-900 font-bold' : 'text-[9px] text-zinc-500 font-mono'}>$64.00/yr • Save $20</span>
              </button>
            </div>

            {/* Comparison specs list */}
            <div className="space-y-3 bg-zinc-950/40 border border-zinc-850 p-4.5 rounded-2xl">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                Premium Feature Packages Include:
              </span>
              <ul className="space-y-2.5 text-xs text-zinc-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-semibold">Increased Daily Search Caps</strong>: Upgraded from 10 limits to <strong className="text-orange-400 font-bold">20 real-time searches per day</strong>.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-semibold flex items-center gap-1">Gemini Chat Coach Assistant <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[8px] rounded px-1 py-0 font-bold uppercase tracking-wider font-mono shrink-0">Bot</span></strong>: Chat with the AI directly from the crm to write script drafts, counter clients, or solve objection concerns.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-semibold">Bespoke SWOT & SEO Audits</strong>: Unlocks competitive rankings breakdowns, estimations for neighborhood traffic loss, and localized strategy plans.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-semibold">Weekly Radar Automation</strong>: Lock auto-runs to scan territories in the background without manually launching searches.
                  </div>
                </li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs flex items-start gap-2">
                <span className="font-extrabold shrink-0">⚠️ Error: </span>
                <span>{error}</span>
              </div>
            )}

            {/* Trial & purchase Trigger action */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleCheckout}
                disabled={loading}
                className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-extrabold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" /> Deploying Paystack Workspace...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4.5 w-4.5" /> Start 3-Day Free Trial
                  </>
                )}
              </button>
              
              <div className="text-center">
                <span className="text-[10px] text-zinc-500 leading-normal block">
                  💳 Standard credit/debit card required to initiate 3-day trial. Zero charge today. Cancellation is single-click from profile.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
