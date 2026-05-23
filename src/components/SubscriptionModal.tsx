import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Sparkles, Loader2, ArrowRightLeft, ShieldCheck, Zap, Mail, Check, AlertCircle, Link } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SubscriptionModal({ isOpen, onClose }: SubscriptionModalProps) {
  const { 
    user, 
    profile, 
    connectGmail, 
    disconnectGmail, 
    connectOutlook, 
    disconnectOutlook,
    updateUserSubscription
  } = useAuth();
  const isPro = profile?.subscriptionTier === 'pro';
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [outlookConnecting, setOutlookConnecting] = useState(false);
  const [outlookEmailInput, setOutlookEmailInput] = useState('');

  // Lock background body scroll to eliminate jitter
  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

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
          <div className="space-y-6">
            <div className="text-center pb-4 border-b border-zinc-900">
              <div className="bg-orange-500/15 border border-orange-500/25 p-3 rounded-2xl max-w-xs mx-auto text-orange-400 text-sm font-bold flex items-center justify-center gap-2">
                <Zap className="h-4.5 w-4.5 fill-orange-500 text-orange-500 animate-pulse" /> Active Pro Subscription
              </div>
              <p className="text-xs text-zinc-400 max-w-md mx-auto mt-2 leading-relaxed">
                Your account is successfully upgraded to **LeadsRadar Pro**! You enjoy increased search limits, competitive SEO and SWOT analytics, and interactive replies tracking.
              </p>
            </div>

            {/* Email Integrations Menu (Pro Exclusive Features) */}
            <div className="space-y-4 bg-zinc-950/60 border border-zinc-850 p-5 rounded-2xl">
              <div className="flex items-center gap-1.5 pb-2.5 border-b border-zinc-900">
                <Mail className="h-4.5 w-4.5 text-orange-500" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Outbound Email Connection Settings</h3>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
                Connect your real Google or Outlook Account in sandbox to directly transmit high-ticket outreach scripts and pitch mails. If a connected prospect replies, Outreach AI will notify you and generate suggesting responses!
              </p>

              {/* GMAIL AUTH SECTION */}
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-red-500/10 text-red-500 rounded-lg">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-white block">Google Gmail Service Connection</span>
                      <span className="text-[10px] text-zinc-500 font-mono">Requires gmail.send & readonly scopes</span>
                    </div>
                  </div>
                  {profile?.gmailConnected ? (
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[9px] font-bold uppercase font-mono">
                      <Check className="h-3 w-3" /> Connected
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-zinc-950 text-zinc-500 px-2 py-0.5 rounded-md border border-zinc-805 text-[9px] font-semibold uppercase font-mono">
                      Disconnected
                    </div>
                  )}
                </div>

                {profile?.gmailConnected ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-zinc-850/50">
                    <span className="text-xs font-mono text-zinc-400">
                      📧 Connected as: <strong className="text-white select-all">{profile.gmailEmail}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm("Disconnect your Gmail credentials? Outreach will fall back to using your computer's standard mailto: launcher.")) {
                          await disconnectGmail();
                        }
                      }}
                      className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-1 text-[10px] rounded-lg font-bold cursor-pointer transition-all self-end"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-zinc-850/50 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={gmailConnecting}
                      onClick={async () => {
                        setGmailConnecting(true);
                        try {
                          await connectGmail();
                        } catch (err: any) {
                          alert(err.message || "Failed to retrieve Google authorizations.");
                        } finally {
                          setGmailConnecting(false);
                        }
                      }}
                      className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-zinc-950 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/10 cursor-pointer transition-all active:scale-98"
                    >
                      {gmailConnecting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying OAuth Scopes with Google...
                        </>
                      ) : (
                        <>
                          <Link className="h-3.5 w-3.5" /> Authenticate Direct Gmail Account
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* OUTLOOK OUTREACH SECTION */}
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-white block">Microsoft Outlook Sandbox</span>
                      <span className="text-[10px] text-zinc-500 font-mono">Sandbox outbound trigger & mock responder</span>
                    </div>
                  </div>
                  {profile?.outlookConnected ? (
                    <div className="flex items-center gap-1.5 bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-md border border-sky-500/20 text-[9px] font-bold uppercase font-mono">
                      <Check className="h-3 w-3" /> Connected
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-zinc-950 text-zinc-500 px-2 py-0.5 rounded-md border border-zinc-805 text-[9px] font-semibold uppercase font-mono">
                      Disconnected
                    </div>
                  )}
                </div>

                {profile?.outlookConnected ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-zinc-850/50">
                    <span className="text-xs font-mono text-zinc-400">
                      📧 Connected with: <strong className="text-white select-all">{profile.outlookEmail}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await disconnectOutlook();
                      }}
                      className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-1 text-[10px] rounded-lg font-bold cursor-pointer transition-all self-end"
                    >
                      Disconnect Outlook
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-zinc-850/50 flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="email"
                      placeholder="e.g. sales@myagency.local"
                      value={outlookEmailInput}
                      onChange={(e) => setOutlookEmailInput(e.target.value)}
                      className="w-full sm:flex-1 text-xs py-2.5 px-3 rounded-lg border border-zinc-800 focus:outline-hidden focus:border-orange-500 bg-zinc-950 text-zinc-200 placeholder:text-zinc-600 font-sans"
                    />
                    <button
                      type="button"
                      disabled={outlookConnecting || !outlookEmailInput.includes('@')}
                      onClick={async () => {
                        setOutlookConnecting(true);
                        try {
                          await connectOutlook(outlookEmailInput);
                          setOutlookEmailInput('');
                        } catch (err: any) {
                          alert(err.message || "Failed to register mock Outlook sandbox account.");
                        } finally {
                          setOutlookConnecting(false);
                        }
                      }}
                      className="w-full sm:w-auto bg-zinc-100 hover:bg-white text-zinc-950 font-bold px-4 py-2.5 text-xs rounded-lg cursor-pointer transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Connect Outlook
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Sandbox Developer Controls */}
            <div className="pt-4 border-t border-zinc-900 flex flex-col items-center gap-2 bg-zinc-950/40 p-4 rounded-xl border border-dashed border-orange-500/25">
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-bold">Sandbox Testing Console</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await updateUserSubscription('free', 'none');
                  } catch (err: any) {
                    alert(err.message || "Failed sandbox toggle.");
                  }
                }}
                className="w-full text-center bg-orange-500/10 hover:bg-orange-500/25 border border-orange-500/30 text-orange-400 py-2 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all flex items-center justify-center gap-1.5"
              >
                <Zap className="h-3.5 w-3.5 fill-orange-400 text-orange-400 animate-pulse" />
                Simulate Account Downgrade to Free Tier
              </button>
            </div>

            <div className="pt-4 border-t border-zinc-850 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
              <span>Subscription ID: <span className="text-zinc-400">{profile?.subscriptionId || 'Active trial session'}</span></span>
              <span>Workspace License Verified</span>
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

              {/* Sandbox Direct Pro Activation */}
              <div className="pt-4 border-t border-zinc-900 flex flex-col items-center gap-2 bg-zinc-950/40 p-4 rounded-xl border border-dashed border-orange-500/25">
                <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest font-bold">Sandbox Testing Console</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const expiryDate = new Date();
                      expiryDate.setDate(expiryDate.getDate() + 30);
                      await updateUserSubscription(
                        'pro',
                        'month',
                        expiryDate.toISOString(),
                        `sandbox_direct_${Date.now()}`
                      );
                    } catch (err: any) {
                      alert(err.message || "Failed sandbox upgrade.");
                    }
                  }}
                  className="w-full text-center bg-orange-500 hover:bg-orange-600 font-bold text-zinc-950 py-2 rounded-lg text-xs cursor-pointer select-none transition-all flex items-center justify-center gap-1.5"
                >
                  <Zap className="h-3.5 w-3.5 fill-zinc-950 text-zinc-950 animate-pulse" />
                  Instantly Activate Pro Tier
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
