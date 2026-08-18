import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Client, Project, InventoryItem, AccessGrant } from '@/types';
import { MetricCard } from '@/components/common/MetricCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  Building2,
  FolderGit2,
  Server,
  KeyRound,
  ShieldAlert,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { NavTab } from '@/components/layout/Sidebar';

export const DashboardPage: React.FC<{ setActiveTab: (t: NavTab) => void }> = ({ setActiveTab }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);

  useEffect(() => {
    api.getClients().then(setClients);
    api.getProjects().then(setProjects);
    api.getInventories().then(setInventories);
    api.getAccessGrants().then(setGrants);
  }, []);

  const pendingApprovals = grants.filter((g) => g.status === 'PENDING' || g.status === 'ENDORSED');
  const activeGrants = grants.filter((g) => g.status === 'ACTIVE');
  const clientAssets = inventories.filter((i) => i.assetScope === 'CLIENT');
  const internalAssets = inventories.filter((i) => i.assetScope === 'INTERNAL');

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-brand-950/40 via-slate-900 to-slate-900 p-6 rounded-2xl border border-brand-500/20 shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Operations & Privileged Access Control Center
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitoring multi-tenant client infrastructure, internal assets, and time-bounded zero-trust grants.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('access')}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 flex items-center gap-2 transition-all"
          >
            <KeyRound className="w-4 h-4" />
            Request Privileged Access
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Managed Clients"
          value={clients.length}
          subtitle="Active contract portfolios"
          icon={Building2}
          color="blue"
          trend="+100% YoY SLA compliance"
        />
        <MetricCard
          title="Active Projects"
          value={projects.length}
          subtitle="Cross-functional squads"
          icon={FolderGit2}
          color="purple"
          trend="2 in active migration"
        />
        <MetricCard
          title="Total CMDB Assets"
          value={inventories.length}
          subtitle={`${clientAssets.length} Client / ${internalAssets.length} Internal`}
          icon={Server}
          color="emerald"
          trend="GCP, AWS, WireGuard"
        />
        <MetricCard
          title="Pending PAM Approvals"
          value={pendingApprovals.length}
          subtitle="Awaiting lead endorsement"
          icon={KeyRound}
          color="amber"
          trend={pendingApprovals.length > 0 ? 'Requires immediate action' : 'Queue clear'}
          trendType={pendingApprovals.length > 0 ? 'warning' : 'positive'}
        />
      </div>

      {/* Two Column Grid: Pending Approvals Queue & Active Access Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Pending Access Approvals</h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                {pendingApprovals.length} Requests
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs flex flex-col items-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mb-2" />
                  No pending access requests in queue.
                </div>
              ) : (
                pendingApprovals.map((grant) => (
                  <div
                    key={grant.id}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{grant.inventory?.name || 'Asset'}</span>
                          <StatusBadge status={grant.accessLevel} />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Requested by: <span className="text-slate-300 font-semibold">{grant.employee?.firstName} {grant.employee?.lastName}</span>
                        </p>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {grant.metadata?.durationHours || 4}h TTL
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 italic">
                      "{grant.justification}"
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => {
                          api.approveAccess(grant.id).then(() => {
                            api.getAccessGrants().then(setGrants);
                          });
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        Approve & Issue Vault Token
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('access')}
            className="w-full mt-4 pt-3 border-t border-slate-800 text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center justify-center gap-1"
          >
            View Full Access Matrix & Audit Logs <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Recent CMDB Assets */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-bold text-white">Unified Infrastructure Assets</h3>
              </div>
              <button
                onClick={() => setActiveTab('inventories')}
                className="text-xs text-brand-400 hover:underline flex items-center gap-1"
              >
                All Assets <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {inventories.slice(0, 4).map((inv) => (
                <div
                  key={inv.id}
                  className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-mono font-bold text-emerald-400">
                      {inv.provider.slice(0, 3)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{inv.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {inv.primaryIp} • {inv.region}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={inv.assetScope} />
                    <StatusBadge status={inv.assetType} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>PostgreSQL 17 Unified Single-Table CMDB</span>
            <span className="font-mono text-emerald-400">0 ms multi-table join penalty</span>
          </div>
        </div>
      </div>
    </div>
  );
};
