import React from 'react';
import {
  LayoutDashboard,
  Building2,
  FolderGit2,
  Server,
  KeyRound,
  Users,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export type NavTab = 'dashboard' | 'clients' | 'projects' | 'inventories' | 'access' | 'employees';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'clients' as NavTab, label: 'Clients & Contracts', icon: Building2 },
    { id: 'projects' as NavTab, label: 'Projects & Staffing', icon: FolderGit2 },
    { id: 'inventories' as NavTab, label: 'Unified CMDB Assets', icon: Server, badge: 'Unified' },
    { id: 'access' as NavTab, label: 'PAM & Access Approvals', icon: KeyRound, badge: 'Live TTL' },
    { id: 'employees' as NavTab, label: 'Org Hierarchy & Teams', icon: Users },
  ];

  return (
    <aside className="w-64 bg-[#0D131F] border-r border-slate-800/80 flex flex-col justify-between p-4 shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-3 py-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
              V-CAMS <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">v2.0</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">MSP & PAM Asset Matrix</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-brand-500/20 to-emerald-500/5 text-brand-400 border border-brand-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Security Badge */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
          <ShieldCheck className="w-4 h-4" />
          <span>PAM Zero-Trust</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-snug">
          PostgreSQL 17 + Keycloak 26 + Vault SSH CA integrated.
        </p>
      </div>
    </aside>
  );
};
