import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { Sparkles, Mail, Lock, User, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
// @ts-ignore
import brandLogo from '../assets/images/logo_1779885424761.png';

export const AuthView: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isRegister) {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        await signUpWithEmail(email, password, name || 'Outreach Member');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      console.error(err);
      let message = err.message || 'An error occurred during authentication.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        message = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'An account with this email already exists.';
      } else if (err.code === 'auth/operation-not-allowed') {
        message = 'Email & password login is disabled. Please run Google Sign-In or enable Email auth in your Firebase console.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in with Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4">
      {/* Visual background accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-zinc-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 animate-fadeIn">
        
        {/* Logo Panel */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-zinc-900 border border-zinc-800 p-0 mb-4 shadow-xl overflow-hidden">
            <img 
              src={brandLogo} 
              alt="LeadsRadar Logo" 
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">LeadsRadar</h1>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Interactive B2B search engine & outbound CRM mapping web-absence local businesses directly to premium HTML pipelines.
          </p>
        </div>

        {/* Authentication Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex border-b border-zinc-800 pb-4">
            <button
              onClick={() => { setIsRegister(false); setError(null); }}
              className={`flex-1 text-center py-2 text-xs font-bold tracking-wider uppercase transition-colors ${!isRegister ? 'text-orange-500 border-b-2 border-orange-500 -mb-[18px]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsRegister(true); setError(null); }}
              className={`flex-1 text-center py-2 text-xs font-bold tracking-wider uppercase transition-colors ${isRegister ? 'text-orange-500 border-b-2 border-orange-500 -mb-[18px]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-950 text-rose-400 text-xs p-3.5 rounded-xl">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-500 mt-0.5" />
              <div>
                <p className="font-bold">Authentication Failed</p>
                <p className="text-[10px] text-rose-300 mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-zinc-500" /> Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rachel Green"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={isRegister}
                  className="w-full text-xs p-2.5 rounded-lg border border-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-zinc-950 text-zinc-200 placeholder:text-zinc-600"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-zinc-500" /> Email Address
              </label>
              <input
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full text-xs p-2.5 rounded-lg border border-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-zinc-950 text-zinc-200 placeholder:text-zinc-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-zinc-500" /> Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full text-xs p-2.5 rounded-lg border border-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-zinc-950 text-zinc-200 placeholder:text-zinc-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-xs font-bold text-zinc-950 flex items-center justify-center gap-1.5 shadow-xl hover:shadow-orange-500/10 cursor-pointer transition-all disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : isRegister ? 'Apply Registration' : 'Open Workspace'}
              {!loading && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </form>

          {/* Separation indicator */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-[1px] bg-zinc-800" />
            <span className="text-[10px] font-semibold text-zinc-650 uppercase tracking-wide">Or connect via</span>
            <div className="flex-1 h-[1px] bg-zinc-800" />
          </div>

          {/* Social Google Login Button */}
          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full py-2.5 rounded-lg border border-zinc-800 hover:bg-zinc-850 bg-zinc-950 hover:border-zinc-700 text-xs font-semibold text-zinc-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            {/* Elegant SVG Google Icon */}
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path 
                fill="#EA4335" 
                d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.137 4.114a5.5 5.5 0 0 1 0-11c1.455 0 2.783.56 3.792 1.487l3.111-3.11A9.96 9.96 0 0 0 12.24 2c-5.523 0-10 4.477-10 10s4.477 10 10 10c5.783 0 9.814-4.061 9.814-9.8 0-.665-.06-1.3-.173-1.915H12.24Z" 
                referrerPolicy="no-referrer"
              />
            </svg>
            Continue with Google account
          </button>

          {isRegister && (
            <div className="flex items-start gap-2 bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
              <ShieldCheck className="h-4.5 w-4.5 text-zinc-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                <strong>Console Notice</strong>: Standard manual password creation requires the "Email & Password" Auth provider active in your custom Firebase console. For seamless immediate experience, Google accounts are configured out-of-the-box.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
