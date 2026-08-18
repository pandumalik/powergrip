import React from 'react';
import { useAuth, DEMO_USERS } from '@/context/AuthContext';
import { Shield, Bell, UserCheck, RefreshCw } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentUser, switchUserRole } = useAuth();

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0B0F17]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-400">PostgreSQL 17:</span>
          <span className="font-semibold text-emerald-400">Connected</span>
        </div>

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400">Keycloak IAM:</span>
          <span className="font-semibold text-blue-400">vcams-realm</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Role Persona Switcher for Quick Live Testing */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium hidden sm:inline flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-brand-400" /> Role Persona:
          </span>
          <select
            value={currentUser.role}
            onChange={(e) => switchUserRole(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-500 font-semibold"
          >
            {DEMO_USERS.map((u) => (
              <option key={u.id} value={u.role}>
                {u.role} ({u.name.split(' ')[0]})
              </option>
            ))}
          </select>
        </div>

        <div className="h-6 w-[1px] bg-slate-800" />

        {/* User Profile Avatar */}
        <div className="flex items-center gap-3">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-8 h-8 rounded-full border border-slate-700 object-cover"
          />
          <div className="hidden lg:block text-left">
            <p className="text-xs font-bold text-white leading-tight">{currentUser.name}</p>
            <p className="text-[10px] text-slate-400 font-mono">{currentUser.jobTitle}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
