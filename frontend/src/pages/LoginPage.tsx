import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTenantConfig } from '@/context/TenantConfigContext';
import {
  Zap,
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  Key,
  X,
  ExternalLink,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithCredentials } = useAuth();
  const { config } = useTenantConfig();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Google OAuth Configuration State
  const [googleClientId, setGoogleClientId] = useState<string>(() => {
    return (
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      localStorage.getItem('powergrip_google_client_id') ||
      ''
    );
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [inputClientId, setInputClientId] = useState(googleClientId);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Google Identity Services when Client ID is available
  useEffect(() => {
    if (!googleClientId) return;

    const checkGsi = () => {
      const google = (window as any).google;
      if (google?.accounts?.id && googleBtnContainerRef.current) {
        try {
          google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          googleBtnContainerRef.current.innerHTML = '';
          google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'filled_black',
            size: 'large',
            shape: 'rectangular',
            text: 'continue_with',
            width: 380,
          });
        } catch (err) {
          console.warn('Google Identity button initialization notice:', err);
        }
      }
    };

    const timer = setInterval(() => {
      if ((window as any).google?.accounts?.id) {
        checkGsi();
        clearInterval(timer);
      }
    }, 300);

    return () => clearInterval(timer);
  }, [googleClientId]);

  // Handle Google ID Token (JWT) from Google Identity Services button
  const handleGoogleCredentialResponse = async (response: any) => {
    if (!response?.credential) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Decode JWT payload
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(jsonPayload);

      await loginWithGoogle({
        email: payload.email,
        name: payload.name || payload.given_name,
        picture: payload.picture,
        sub: payload.sub,
        credential: response.credential,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Google authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger Google OAuth 2.0 Popup
  const triggerGoogleLoginPopup = () => {
    if (!googleClientId) {
      setShowConfigModal(true);
      return;
    }

    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      setErrorMessage('Google Identity Services library is still loading. Please try again in a moment.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'email profile openid',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            setIsSubmitting(false);
            setErrorMessage(`Google sign-in was cancelled or encountered an error: ${tokenResponse.error}`);
            return;
          }

          try {
            // Fetch real user profile from Google's official userinfo endpoint
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });
            if (!res.ok) {
              throw new Error('Failed to retrieve user profile from Google');
            }
            const userInfo = await res.json();

            await loginWithGoogle({
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture,
              sub: userInfo.sub,
              token: tokenResponse.access_token,
            });
          } catch (err: any) {
            setErrorMessage(err.message || 'Failed to authenticate Google session');
          } finally {
            setIsSubmitting(false);
          }
        },
      });

      client.requestAccessToken({ prompt: 'select_account' });
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Failed to initiate Google authentication popup');
    }
  };

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = inputClientId.trim();
    if (!cleanId) {
      setErrorMessage('Please enter a valid Google OAuth Client ID');
      return;
    }
    setGoogleClientId(cleanId);
    localStorage.setItem('powergrip_google_client_id', cleanId);
    setShowConfigModal(false);
    setErrorMessage(null);
  };

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your corporate email address');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await loginWithCredentials(email.trim(), password);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Invalid credentials. Please verify your email or sign in with Google.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col justify-between text-slate-100 selection:bg-brand-500 selection:text-white relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-15%] left-[20%] w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[15%] w-[450px] h-[450px] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Header */}
      <header className="px-8 py-5 flex items-center justify-between border-b border-slate-800/60 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-2">
              {config.appName}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">{config.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <ShieldCheck className="w-4 h-4 text-brand-400" />
          <span>Privileged Access & Governance</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 z-10">
        <div className="w-full max-w-md space-y-6">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl relative bg-[#0D131F]/90">
            <div className="mb-6 text-center">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Sign in to Console
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Zero-Trust Privileged Access & Infrastructure Matrix
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Real Google Login Action */}
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={triggerGoogleLoginPopup}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 hover:border-slate-500 text-xs font-semibold shadow-md transition-all group outline-none focus:outline-none cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              {/* Native Google One Tap Button Container (if initialized) */}
              <div ref={googleBtnContainerRef} className="flex justify-center" />

              {/* Client ID Configuration Indicator / Link */}
              <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
                <span>
                  {googleClientId ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-mono text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Google OAuth Configured
                    </span>
                  ) : (
                    <span className="text-amber-400/80">Google OAuth not yet connected</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(true)}
                  className="text-slate-400 hover:text-brand-400 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Key className="w-3 h-3" />
                  <span>{googleClientId ? 'Change Client ID' : 'Configure Client ID'}</span>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-6">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-[#0D131F] px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                Or sign in with corporate email
              </span>
            </div>

            {/* Keycloak Hierarchy Quick-Fill Selector */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-400">
                  Keycloak Directory Roles:
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Select to test hierarchy</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@powergrip.internal');
                    setPassword('AdminPass2026!');
                    setErrorMessage(null);
                  }}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    email === 'admin@powergrip.internal'
                      ? 'border-emerald-500 bg-emerald-500/15 shadow-sm shadow-emerald-500/20'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">Admin</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">L1</span>
                  </div>
                  <p className="text-[10px] text-slate-300 truncate mt-0.5">Sarah J.</p>
                  <p className="text-[9px] text-slate-500 truncate">Executive</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('manager@powergrip.internal');
                    setPassword('ManagerPass2026!');
                    setErrorMessage(null);
                  }}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    email === 'manager@powergrip.internal'
                      ? 'border-blue-500 bg-blue-500/15 shadow-sm shadow-blue-500/20'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400">Manager</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono">L2</span>
                  </div>
                  <p className="text-[10px] text-slate-300 truncate mt-0.5">Marcus V.</p>
                  <p className="text-[9px] text-slate-500 truncate">Squad Lead</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('employee@powergrip.internal');
                    setPassword('EmployeePass2026!');
                    setErrorMessage(null);
                  }}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    email === 'employee@powergrip.internal'
                      ? 'border-purple-500 bg-purple-500/15 shadow-sm shadow-purple-500/20'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-400">Employee</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">L3</span>
                  </div>
                  <p className="text-[10px] text-slate-300 truncate mt-0.5">Elena R.</p>
                  <p className="text-[9px] text-slate-500 truncate">Engineer</p>
                </button>
              </div>
            </div>

            {/* Standard Corporate Form */}
            <form onSubmit={handleStandardLogin} className="space-y-4 pt-1">
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
                    placeholder="name@company.com"
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Password</label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-600/20 transition-all outline-none focus:outline-none cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Sign in with Keycloak</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 z-10">
        <div>&copy; 2026 {config.appName} Platform. All rights reserved.</div>
        <div className="text-slate-500">
          Enterprise Privileged Access Management
        </div>
      </footer>

      {/* Modal: Configure Google OAuth 2.0 Client ID */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0D131F] border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowConfigModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                <Key className="w-4 h-4 text-brand-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Google OAuth 2.0 Client ID</h3>
                <p className="text-[11px] text-slate-400">Connect your real Google Sign-In</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              To authenticate with your genuine Google Account, provide your Web OAuth Client ID created in the{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-brand-400 hover:underline inline-flex items-center gap-0.5 font-semibold"
              >
                Google Cloud Console <ExternalLink className="w-3 h-3" />
              </a>.
            </p>

            <div className="mb-4 p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
              <div className="text-slate-300 font-semibold font-sans">Authorized JavaScript origins:</div>
              <div className="text-emerald-400">http://localhost:5173</div>
            </div>

            <form onSubmit={handleSaveClientId} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Client ID (.apps.googleusercontent.com)
                </label>
                <input
                  type="text"
                  value={inputClientId}
                  onChange={(e) => setInputClientId(e.target.value)}
                  placeholder="xxxx-yyyy.apps.googleusercontent.com"
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-lg transition-colors cursor-pointer"
                >
                  Save & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
