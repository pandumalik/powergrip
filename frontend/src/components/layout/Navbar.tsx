import React, { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogOut, Shield } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentUser, logout, permissions } = useAuth();

  const roleBadge = useMemo(() => {
    switch (permissions.role) {
      case 'Admin':
        return {
          title: 'Executive Level 1 (Full Governance Authority)',
          tag: 'Admin (L1)',
          classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        };
      case 'Manager':
        return {
          title: 'Operations Level 2 (Squad Management & Approvals)',
          tag: 'Manager (L2)',
          classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        };
      case 'Employee':
      default:
        return {
          title: 'Engineering Level 3 (Least Privilege Access)',
          tag: 'Employee (L3)',
          classes: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        };
    }
  }, [permissions.role]);

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0B0F17]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left Title / Context */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
          <Shield className="w-4 h-4 text-brand-400" />
          <span className="font-semibold text-slate-200">Enterprise Governance Console</span>
        </div>
      </div>

      {/* Right User Profile & Sign Out */}
      <div className="flex items-center gap-3 sm:gap-4">
        {currentUser && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full border border-slate-700 object-cover shrink-0"
              />
              {currentUser.authProvider === 'google' && (
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center shadow-sm" title="Signed in with Google">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
              )}
            </div>

            <div className="hidden sm:block text-left max-w-[200px]">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-white leading-tight truncate">
                  {currentUser.name}
                </p>
                <span
                  title={roleBadge.title}
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${roleBadge.classes}`}
                >
                  {roleBadge.tag}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono truncate" title={currentUser.email}>
                {currentUser.email}
              </p>
            </div>

            <div className="h-5 w-[1px] bg-slate-800" />

            {/* Clean Sign Out Button */}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-colors outline-none focus:outline-none cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
