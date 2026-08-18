import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { AccessGrant, InventoryItem, Project, AccessAuditLog } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  KeyRound,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Clock,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export const AccessManagementPage: React.FC = () => {
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [auditLogs, setAuditLogs] = useState<AccessAuditLog[]>([]);

  const [activeTab, setActiveTab] = useState<'matrix' | 'pending' | 'audit'>('matrix');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Request Form State
  const [inventoryId, setInventoryId] = useState('');
  const [accessLevel, setAccessLevel] = useState<any>('READ_WRITE');
  const [durationHours, setDurationHours] = useState(4);
  const [justification, setJustification] = useState('');

  const loadData = () => {
    api.getAccessGrants().then(setGrants);
    api.getInventories().then(setInventories);
    api.getProjects().then(setProjects);
    api.getAuditLogs().then(setAuditLogs);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inventoryId || !justification) return;

    await api.requestAccess({
      inventoryId,
      accessLevel,
      grantType: 'TEMPORARY_TIMED',
      durationHours: Number(durationHours),
      justification,
    });

    setIsModalOpen(false);
    setJustification('');
    loadData();
  };

  const handleApprove = async (id: string) => {
    await api.approveAccess(id, 'Approved via PAM Web Portal');
    loadData();
  };

  const handleReject = async (id: string) => {
    await api.rejectAccess(id, 'Declined by Administrator');
    loadData();
  };

  const handleRevoke = async (id: string) => {
    await api.revokeAccess(id, 'Emergency administrative revocation');
    loadData();
  };

  const pendingGrants = grants.filter((g) => g.status === 'PENDING' || g.status === 'ENDORSED');
  const activeGrants = grants.filter((g) => g.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-400" />
            Privileged Access Management (PAM) & Ephemeral Grants
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Zero-Trust access governance with automated TTL expiration, HashiCorp Vault SSH certificates, and live kill switch.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Request Timed Access
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'matrix'
              ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Active Access Matrix ({activeGrants.length})
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Pending Approvals Queue ({pendingGrants.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Session Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* Tab Content 1: Active Matrix */}
      {activeTab === 'matrix' && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Authorized Employee</th>
                  <th className="px-4 py-3.5">Target Inventory Asset</th>
                  <th className="px-4 py-3.5">Access Level</th>
                  <th className="px-4 py-3.5">Grant Type & Time Window</th>
                  <th className="px-4 py-3.5 text-right">Kill Switch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {activeGrants.map((grant) => (
                  <tr key={grant.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-brand-400">
                          {grant.employee?.firstName?.[0] || 'E'}
                        </div>
                        <div>
                          <p className="font-bold text-white text-xs">
                            {grant.employee?.firstName} {grant.employee?.lastName}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">{grant.employee?.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-bold text-white text-xs">{grant.inventory?.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {grant.inventory?.assetTag} • {grant.inventory?.provider}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={grant.accessLevel} />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 text-slate-300 font-mono text-xs">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        {grant.grantType === 'PERMANENT' ? (
                          <span className="text-cyan-400">Indefinite (Corp VPN)</span>
                        ) : (
                          <span className="text-emerald-400">Valid until {grant.validUntil?.slice(11, 16)} UTC</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleRevoke(grant.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors"
                      >
                        Revoke Grant
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content 2: Pending Approvals Queue */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingGrants.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center text-slate-500 text-xs flex flex-col items-center">
              <CheckCircle className="w-10 h-10 text-emerald-500/50 mb-2" />
              No pending access requests requiring approval.
            </div>
          ) : (
            pendingGrants.map((grant) => (
              <div
                key={grant.id}
                className="glass-panel rounded-2xl p-5 border border-amber-500/30 shadow-lg shadow-amber-500/5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        REQUEST #REQ-{grant.id.slice(-4)}
                      </span>
                      <StatusBadge status={grant.accessLevel} />
                    </div>

                    <h3 className="text-base font-bold text-white mt-2">
                      Request for {grant.inventory?.name} ({grant.inventory?.assetTag})
                    </h3>

                    <p className="text-xs text-slate-400 mt-1">
                      Submitted by:{' '}
                      <span className="text-slate-200 font-semibold">
                        {grant.employee?.firstName} {grant.employee?.lastName} ({grant.employee?.jobTitle})
                      </span>
                    </p>

                    <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
                      <span className="text-slate-400 block font-semibold mb-1">Business Justification:</span>
                      "{grant.justification}"
                    </div>
                  </div>

                  <div className="flex sm:flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(grant.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve Grant
                    </button>
                    <button
                      onClick={() => handleReject(grant.id)}
                      className="px-4 py-2 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 rounded-xl text-xs font-semibold border border-slate-700 hover:border-rose-700/50 flex items-center gap-1.5 transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content 3: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5">Action Event</th>
                  <th className="px-4 py-3.5">IP Address</th>
                  <th className="px-4 py-3.5">Session ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40">
                    <td className="px-5 py-3.5 text-slate-400">{log.createdAt}</td>
                    <td className="px-4 py-3.5 font-bold text-emerald-400">{log.action}</td>
                    <td className="px-4 py-3.5 text-slate-300">{log.ipAddress || '180.252.120.45'}</td>
                    <td className="px-4 py-3.5 text-slate-400">{log.sessionId || `sess-${log.id.slice(-6)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request Access Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              Request Timed Privileged Access (PAM)
            </h3>
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Inventory Asset</label>
                <select
                  value={inventoryId}
                  onChange={(e) => setInventoryId(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="">Select target VM / Cloud / K8s asset...</option>
                  {inventories.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.assetTag} • {i.provider})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Privilege Level</label>
                  <select
                    value={accessLevel}
                    onChange={(e) => setAccessLevel(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="READ_WRITE">Read-Write</option>
                    <option value="ADMIN">Administrator</option>
                    <option value="ROOT_SUPERADMIN">Root / SuperAdmin</option>
                    <option value="OPERATOR">Operator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Duration (Hours TTL)</label>
                  <select
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                  >
                    <option value={1}>1 Hour TTL</option>
                    <option value={2}>2 Hours TTL</option>
                    <option value={4}>4 Hours TTL (Standard)</option>
                    <option value={8}>8 Hours TTL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Business Reason & Ticket Reference</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Applying critical security patch on Kubernetes master nodes (Ticket #INC-9912)."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-600/20"
                >
                  Submit Access Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
