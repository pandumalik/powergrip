import React, { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  FolderGit2,
  Server,
  KeyRound,
  Users,
  ShieldCheck,
  Zap,
  Settings,
  Moon,
  Sun,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useTenantConfig } from '@/context/TenantConfigContext';
import { SettingsModal } from '@/components/common/SettingsModal';

export type NavTab = 'dashboard' | 'clients' | 'projects' | 'inventories' | 'access' | 'employees';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { isDark, toggleTheme } = useTheme();
  const { config } = useTenantConfig();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'clients' as NavTab, label: 'Clients', icon: Building2 },
    { id: 'projects' as NavTab, label: 'Projects', icon: FolderGit2 },
    { id: 'inventories' as NavTab, label: 'Inventory', icon: Server },
    { id: 'access' as NavTab, label: 'Access', icon: KeyRound },
    { id: 'employees' as NavTab, label: 'Employees', icon: Users },
  ];

  return (
    <>
      <aside className="w-64 bg-[#0D131F] border-r border-slate-800/80 flex flex-col justify-between p-4 shrink-0 h-screen sticky top-0">
        <div>
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-3 py-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Zap className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                {config.appName}{' '}
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  v{config.version}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium truncate max-w-[150px]" title={config.tagline}>
                {config.tagline}
              </p>
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
                  className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors duration-150 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 select-none ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-500/20 to-brand-500/5 text-brand-400 border-brand-500/30 shadow-sm'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Left Controls: Quick Theme Toggle & Settings */}
        <div className="space-y-2 pt-3 border-t border-slate-800/80">
          {/* Quick Theme & Settings Bar */}
          <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex-1 flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-400" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="System Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Security Badge */}
          <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/80 text-[11px]">
            <div className="flex items-center gap-1.5 text-brand-400 font-semibold mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{config.footer.securityBadge}</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              {config.footer.complianceText}
            </p>
          </div>
        </div>
      </aside>

      {/* Settings Modal Dialog */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};
