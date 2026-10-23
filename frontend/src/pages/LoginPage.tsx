import React, { useState } from 'react';
import { useAuth, DEMO_USERS, UserProfile } from '@/context/AuthContext';
import { useTenantConfig } from '@/context/TenantConfigContext';
import {
  Zap,
  ShieldCheck,
  KeyRound,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  Server,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, loginWithGoogle, gcpStatus } = useAuth();
  const { config } = useTenantConfig();

  const [email, setEmail] = useState('muhammad.galang@ist.id');
  const [password, setPassword] = useState('admin123');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStandardLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    setTimeout(() => {
      // Find matching demo user or default to Muhammad Galang (Admin)
      const matched =
        DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase()) ||
        DEMO_USERS[0];
      login(matched);
      setIsSubmitting(false);
    }, 400);
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to authenticate with Google IAM');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSelect = (user: UserProfile) => {
    login(user);
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col justify-between text-slate-100 selection:bg-brand-500 selection:text-white relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-15%] left-[20%] w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[15%] w-[450px] h-[450px] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Bar */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-slate-800/60 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              {config.appName}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                v{config.version} (Rust)
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">{config.tagline}</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium">
          <ShieldCheck className="w-4 h-4 text-brand-400" />
          <span>Zero-Trust PAM & Identity Gateway</span>
        </div>
      </header>

      {/* Main Content Card Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 z-10">
        <div className="w-full max-w-md space-y-6">
          {/* Main Login Panel */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl relative">
            <div className="mb-6 text-center">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Sign in to Console
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Access privileged cloud assets, customer rosters, and JIT escalation
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Primary Action: Google Cloud / IAM Sign-In */}
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white border border-brand-500/40 hover:border-brand-500 text-xs font-semibold shadow-lg shadow-brand-500/10 transition-all group outline-none focus:outline-none"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                ) : (
                  <div className="w-5 h-5 flex items-center justify-center rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                    <Cloud className="w-3.5 h-3.5 text-brand-400" />
                  </div>
                )}
                <span>Continue with Google Cloud IAM</span>
              </button>

              {/* Detected IAM session indicator */}
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-slate-400">Local GCP Account:</span>
                  <span className="font-mono text-brand-300 font-semibold truncate">
                    {gcpStatus.account || 'muhammad.galang@ist.id'}
                  </span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 font-semibold shrink-0">
                  ADMIN
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-6">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-[#111827] px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                Or sign in with email
              </span>
            </div>

            {/* Standard Form */}
            <form onSubmit={handleStandardLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Corporate Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@vendor.internal"
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Password</label>
                  <span className="text-[11px] text-brand-400 hover:text-brand-300 cursor-pointer">
                    Forgot?
                  </span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-600/20 transition-all outline-none focus:outline-none cursor-pointer"
              >
                <span>Sign in to Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Quick Access Demo Profiles Switcher */}
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold mb-2 px-1">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Quick Role Sandbox Switcher
              </span>
              <span className="text-[10px] text-slate-500">1-Click Access</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DEMO_USERS.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleQuickSelect(user)}
                  className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all flex items-center gap-2.5 group outline-none focus:outline-none"
                >
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-7 h-7 rounded-lg object-cover border border-slate-700 shrink-0"
                  />
                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                      {user.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                      {user.role === 'ADMIN' ? (
                        <span className="text-brand-400 font-bold">Admin (GCP)</span>
                      ) : (
                        <span>{user.role}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Security Badges */}
      <footer className="px-8 py-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 z-10">
        <div>
          &copy; 2026 {config.appName} Platform. Enterprise Privileged Access & Infrastructure Matrix.
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
            SOC-2 Type II Certified
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <KeyRound className="w-3.5 h-3.5 text-blue-400" />
            Vault SSH CA Active
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Server className="w-3.5 h-3.5 text-purple-400" />
            Pure Rust Axum Microservice
          </span>
        </div>
      </footer>
    </div>
  );
};
