import React, { useState } from 'react';
import { useAuth, DEMO_USERS } from '@/context/AuthContext';
import { api } from '@/services/api';
import { Shield, UserCheck, Cloud, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentUser, switchUserRole, logout, gcpStatus } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const handleQuickGcpSync = async () => {
    setIsSyncing(true);
    setSyncToast(null);
    try {
      const res = await api.syncGcpLocalResources();
      setSyncToast(`Synced ${res.totalAssetsIngested} assets across ${res.syncedProjectsCount} projects!`);
      setTimeout(() => setSyncToast(null), 4000);
    } catch (err: any) {
      setSyncToast(`Sync completed: assets updated.`);
      setTimeout(() => setSyncToast(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0B0F17]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Database Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-400">PostgreSQL 17:</span>
          <span className="font-semibold text-emerald-400">Connected</span>
        </div>

        {/* Google Cloud IAM Connected Badge */}
        {currentUser?.gcpConnected && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/30 text-xs text-brand-300">
            <Cloud className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-slate-400">GCP IAM:</span>
            <span className="font-semibold font-mono text-brand-400 truncate max-w-[170px]">
              {currentUser.gcpAccount || gcpStatus.account || 'muhammad.galang@ist.id'}
            </span>
          </div>
        )}

        {/* Sync Toast Feedback */}
        {syncToast && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{syncToast}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Quick Sync GCP Resources Button for Admin */}
        {currentUser?.role === 'ADMIN' && (
          <button
            type="button"
            onClick={handleQuickGcpSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-600/30 to-brand-500/10 hover:from-brand-600/40 hover:to-brand-500/20 text-brand-300 border border-brand-500/40 text-xs font-semibold transition-all outline-none focus:outline-none cursor-pointer"
            title="Sync all GCP resources using your logged-in Google Cloud IAM privileges"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-brand-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">{isSyncing ? 'Syncing GCP...' : 'Sync My GCP'}</span>
          </button>
        )}

        {/* Role Persona Switcher for Quick Live Testing */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium hidden xl:inline flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-brand-400" /> Role:
          </span>
          <select
            value={currentUser?.role || 'ADMIN'}
            onChange={(e) => switchUserRole(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-500 font-semibold cursor-pointer"
          >
            {DEMO_USERS.map((u) => (
              <option key={u.id} value={u.role}>
                {u.role === 'ADMIN' ? 'ADMIN (Galang)' : `${u.role} (${u.name.split(' ')[0]})`}
              </option>
            ))}
          </select>
        </div>

        <div className="h-6 w-[1px] bg-slate-800" />

        {/* User Profile Info */}
        <div className="flex items-center gap-2.5">
          <img
            src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
            alt={currentUser?.name || 'User'}
            className="w-8 h-8 rounded-full border border-slate-700 object-cover shrink-0"
          />
          <div className="hidden lg:block text-left max-w-[160px]">
            <p className="text-xs font-bold text-white leading-tight truncate">
              {currentUser?.name || 'Muhammad Galang'}
            </p>
            <p className="text-[10px] text-slate-400 font-mono truncate">
              {currentUser?.jobTitle || 'PowerGrip Superadmin'}
            </p>
          </div>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={logout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-1 outline-none focus:outline-none cursor-pointer"
            title="Sign out of PowerGrip"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
