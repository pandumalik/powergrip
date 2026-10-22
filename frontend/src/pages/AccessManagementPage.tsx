import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { AccessGrant, InventoryItem, Project, AccessAuditLog, Employee } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { BulkActionToolbar } from '@/components/common/BulkActionToolbar';
import {
  KeyRound,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Clock,
  History,
  CheckCircle,
  XCircle,
  Lock,
  Edit3,
  X,
  Save,
  Trash2,
  User,
  Server,
  AlertCircle,
} from 'lucide-react';

export const AccessManagementPage: React.FC = () => {
  const [grants, setGrants] = useState<AccessGrant[]>(() => api.getCachedAccessGrants());
  const [inventories, setInventories] = useState<InventoryItem[]>(() => api.getCachedInventories());
  const [projects, setProjects] = useState<Project[]>(() => api.getCachedProjects());
  const [employees, setEmployees] = useState<Employee[]>(() => api.getCachedEmployees());
  const [auditLogs, setAuditLogs] = useState<AccessAuditLog[]>(() => api.getCachedAuditLogs());

  const [activeTab, setActiveTab] = useState<'matrix' | 'pending' | 'audit'>('matrix');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGrant, setEditingGrant] = useState<AccessGrant | null>(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  // Revocation / Delete Modal State
  const [revokeTarget, setRevokeTarget] = useState<AccessGrant | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Delete Target Modal State
  const [deleteTarget, setDeleteTarget] = useState<AccessGrant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Request Form State
  const [employeeId, setEmployeeId] = useState('');
  const [inventoryId, setInventoryId] = useState('');
  const [accessLevel, setAccessLevel] = useState<any>('READ_WRITE');
  const [durationHours, setDurationHours] = useState(4);
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const resetRequestForm = () => {
    setEmployeeId(employees[0]?.id || '');
    setInventoryId(inventories[0]?.id || '');
    setAccessLevel('READ_WRITE');
    setDurationHours(4);
    setJustification('');
    setRequestError(null);
  };

  const loadData = async () => {
    const [g, invs, prjs, emps, logs] = await Promise.all([
      api.getAccessGrants(),
      api.getInventories(),
      api.getProjects(),
      api.getEmployees(),
      api.getAuditLogs(),
    ]);
    setGrants(g);
    setInventories(invs);
    setProjects(prjs);
    setEmployees(emps);
    setAuditLogs(logs);

    if (emps.length > 0 && !employeeId) {
      setEmployeeId(emps[0].id);
    }
    if (invs.length > 0 && !inventoryId) {
      setInventoryId(invs[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inventoryId || !justification) {
      setRequestError('Please select a target asset and provide a business justification.');
      return;
    }

    setIsSubmitting(true);
    setRequestError(null);
    try {
      const created = await api.requestAccess({
        employeeId: employeeId || undefined,
        inventoryId,
        accessLevel,
        grantType: 'TEMPORARY_TIMED',
        durationHours: Number(durationHours),
        justification,
      });

      setGrants((prev) => [created, ...prev]);
      setIsModalOpen(false);
      resetRequestForm();
      setActiveTab('pending');
      await loadData();
    } catch (err: any) {
      setRequestError(err.message || 'Failed to submit access request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGrant) return;
    const updated = await api.updateAccessGrant(editingGrant.id, editingGrant);
    setGrants((prev) =>
      prev.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)),
    );
    setEditingGrant(null);
    await loadData();
  };

  const handleApprove = async (id: string) => {
    const approved = await api.approveAccess(id, 'Approved via Web Portal');
    setGrants((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...approved } : g)),
    );
    await loadData();
  };

  const handleReject = async (id: string) => {
    const rejected = await api.rejectAccess(id, 'Declined by Administrator');
    setGrants((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...rejected } : g)),
    );
    await loadData();
  };

  const handleRevokeClick = (grant: AccessGrant, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRevokeTarget(grant);
    setRevokeError(null);
  };

  const handleDeleteClick = (grant: AccessGrant, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteTarget(grant);
    setDeleteError(null);
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    setIsRevoking(true);
    setRevokeError(null);
    try {
      const revoked = await api.revokeAccess(revokeTarget.id, 'Emergency administrative revocation');
      setGrants((prev) =>
        prev.map((g) => (g.id === revokeTarget.id ? { ...g, ...revoked } : g)),
      );
      if (editingGrant?.id === revokeTarget.id) {
        setEditingGrant(null);
      }
      setIsRevoking(false);
      setRevokeTarget(null);
      await loadData();
    } catch (err: any) {
      setIsRevoking(false);
      setRevokeError(err.message || 'Failed to revoke access');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    const res = await api.deleteAccessGrant(deleteTarget.id);
    setIsDeleting(false);
    if (res.success) {
      setGrants((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      if (editingGrant?.id === deleteTarget.id) {
        setEditingGrant(null);
      }
      setDeleteTarget(null);
      await loadData();
    } else {
      setDeleteError(res.error || 'Failed to delete access grant record');
    }
  };

  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    const currentList = activeTab === 'matrix' ? activeGrants : pendingGrants;
    setSelectedIds(currentList.map((g) => g.id));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    setBulkDeleteError(null);
    const res = await api.deleteAccessGrants(selectedIds);
    setIsBulkDeleting(false);
    if (res.success) {
      setGrants((prev) => prev.filter((g) => !selectedIds.includes(g.id)));
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      await loadData();
    } else {
      setBulkDeleteError(res.errors?.join(', ') || 'Failed to delete selected grants');
      await loadData();
    }
  };

  const pendingGrants = grants.filter((g) => g.status === 'PENDING' || g.status === 'ENDORSED');
  const activeGrants = grants.filter((g) => g.status === 'ACTIVE');

  const currentTabItems = activeTab === 'matrix' ? activeGrants : activeTab === 'pending' ? pendingGrants : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-400" />
            Access Management
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {grants.length} Total
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Zero-trust privileged access governance, temporary time-bounded grants, and session audit logs. Click any item to inspect or edit.
          </p>
        </div>

        <button
          onClick={() => {
            if (employees.length > 0 && !employeeId) setEmployeeId(employees[0].id);
            if (inventories.length > 0 && !inventoryId) setInventoryId(inventories[0].id);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Request Access
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => {
            setActiveTab('matrix');
            setSelectedIds([]);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors duration-150 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 flex items-center gap-2 ${
            activeTab === 'matrix'
              ? 'bg-brand-500/20 text-brand-400 border-brand-500/30'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Active Matrix ({activeGrants.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('pending');
            setSelectedIds([]);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors duration-150 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Pending Approvals ({pendingGrants.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('audit');
            setSelectedIds([]);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors duration-150 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <History className="w-4 h-4" />
          Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* Bulk Action Toolbar for Matrix and Pending Tabs */}
      {activeTab !== 'audit' && currentTabItems.length > 0 && (
        <BulkActionToolbar
          selectedCount={selectedIds.length}
          totalCount={currentTabItems.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onDeleteSelected={() => setIsBulkDeleteModalOpen(true)}
          isAllSelected={selectedIds.length === currentTabItems.length && currentTabItems.length > 0}
          resourceName="access grants"
          deleteLabel={`Delete Selected (${selectedIds.length})`}
        />
      )}

      {/* Tab Content 1: Active Matrix */}
      {activeTab === 'matrix' && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
          {activeGrants.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No active access grants found. Click "Request Access" to issue a grant or review pending requests.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === activeGrants.length && activeGrants.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(activeGrants.map((g) => g.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                        className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-brand-500/30 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3.5">Authorized Employee</th>
                    <th className="px-4 py-3.5">Target Inventory Asset</th>
                    <th className="px-4 py-3.5">Access Level</th>
                    <th className="px-4 py-3.5">Grant Type & Time Window</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {activeGrants.map((grant) => {
                    const isSelected = selectedIds.includes(grant.id);
                    return (
                      <tr
                        key={grant.id}
                        onClick={() => setEditingGrant({ ...grant })}
                        className={`hover:bg-slate-900/60 cursor-pointer transition-colors group ${
                          isSelected ? 'bg-brand-500/5' : ''
                        }`}
                      >
                        <td
                          className="w-10 px-4 py-4 text-center"
                          onClick={(e) => handleToggleSelect(grant.id, e)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-brand-500/30 cursor-pointer"
                          />
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-brand-400">
                              {grant.employee?.firstName?.[0] || 'E'}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-bold text-white text-xs group-hover:text-brand-400 transition-colors">
                                  {grant.employee ? `${grant.employee.firstName} ${grant.employee.lastName}` : 'System / Service Account'}
                                </p>
                                <span className="text-[10px] text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                                  <Edit3 className="w-2.5 h-2.5 inline" />
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono">{grant.employee?.email || 'N/A'}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-bold text-white text-xs">{grant.inventory?.name || 'Unknown Asset'}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {grant.inventory?.assetTag || 'N/A'} • {grant.inventory?.provider || 'Custom'}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge status={grant.accessLevel} />
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5 text-slate-300 font-mono text-xs">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            {grant.grantType === 'PERMANENT' ? (
                              <span className="text-cyan-400">Indefinite</span>
                            ) : (
                              <span className="text-emerald-400">
                                Valid until {grant.validUntil ? new Date(grant.validUntil).toLocaleTimeString() : 'Expiry Set'}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={(e) => handleRevokeClick(grant, e)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors"
                              title="Revoke active privileges"
                            >
                              Revoke
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteClick(grant, e)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs transition-colors"
                              title="Delete grant record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
            pendingGrants.map((grant) => {
              const isSelected = selectedIds.includes(grant.id);
              return (
                <div
                  key={grant.id}
                  onClick={() => setEditingGrant({ ...grant })}
                  className={`glass-panel glass-panel-hover rounded-2xl p-5 border transition-all cursor-pointer group ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                      : 'border-amber-500/30 shadow-lg shadow-amber-500/5 hover:border-amber-500/60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="pt-1"
                        onClick={(e) => handleToggleSelect(grant.id, e)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500/30 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            REQUEST #REQ-{grant.id.slice(-4)}
                          </span>
                          <StatusBadge status={grant.accessLevel} />
                          <span className="text-[10px] text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold flex items-center gap-1">
                            <Edit3 className="w-3 h-3" /> Click to Review & Edit
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-white mt-2 group-hover:text-amber-300 transition-colors">
                          Request for {grant.inventory?.name || 'Unknown Asset'} ({grant.inventory?.assetTag || 'N/A'})
                        </h3>

                        <p className="text-xs text-slate-400 mt-1">
                          Submitted by:{' '}
                          <span className="text-slate-200 font-semibold">
                            {grant.employee ? `${grant.employee.firstName} ${grant.employee.lastName} (${grant.employee.jobTitle})` : 'Employee'}
                          </span>
                        </p>

                        <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
                          <span className="text-slate-400 block font-semibold mb-1">Business Justification:</span>
                          "{grant.justification}"
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(grant.id);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(grant.id);
                        }}
                        className="px-4 py-2 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 rounded-xl text-xs font-semibold border border-slate-700 hover:border-rose-700/50 flex items-center gap-1.5 transition-all"
                      >
                        <XCircle className="w-4 h-4" />
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(grant, e)}
                        className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold border border-rose-500/30 flex items-center gap-1.5 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab Content 3: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
          {auditLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No audit logs captured yet. Privileged events and elevation requests will be recorded here.
            </div>
          ) : (
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
          )}
        </div>
      )}

      {/* Edit Access Grant Modal */}
      {editingGrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                Review & Edit Access Grant
              </h3>
              <button
                onClick={() => setEditingGrant(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Asset</label>
                <input
                  type="text"
                  disabled
                  value={`${editingGrant.inventory?.name || 'Unknown'} (${editingGrant.inventory?.assetTag || 'N/A'})`}
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Staff Member</label>
                <input
                  type="text"
                  disabled
                  value={editingGrant.employee ? `${editingGrant.employee.firstName} ${editingGrant.employee.lastName} (${editingGrant.employee.email})` : 'System Service Account'}
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Grant Status</label>
                  <select
                    value={editingGrant.status}
                    onChange={(e) => setEditingGrant({ ...editingGrant, status: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PENDING">PENDING</option>
                    <option value="ENDORSED">ENDORSED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="REVOKED">REVOKED</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Access Level</label>
                  <select
                    value={editingGrant.accessLevel}
                    onChange={(e) => setEditingGrant({ ...editingGrant, accessLevel: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="READ_ONLY">Read Only</option>
                    <option value="OPERATOR">Operator</option>
                    <option value="READ_WRITE">Read Write</option>
                    <option value="ADMIN">Administrator</option>
                    <option value="ROOT_SUPERADMIN">Root / SuperAdmin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Justification</label>
                <textarea
                  rows={2}
                  value={editingGrant.justification}
                  onChange={(e) => setEditingGrant({ ...editingGrant, justification: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Review Notes / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Authorized by Operations Lead"
                  value={editingGrant.reviewNotes || ''}
                  onChange={(e) => setEditingGrant({ ...editingGrant, reviewNotes: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleDeleteClick(editingGrant)}
                  className="px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Grant
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingGrant(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-600/20 flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Access Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                Request Privileged Access
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetRequestForm();
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {requestError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{requestError}</span>
              </div>
            )}

            <form onSubmit={handleRequest} className="space-y-4">
              {/* Employee Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-brand-400" />
                  Staff Member / Requester
                </label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} — {emp.jobTitle} ({emp.department?.name || 'Engineering'})
                    </option>
                  ))}
                  {employees.length === 0 && (
                    <option value="">No employees found in directory</option>
                  )}
                </select>
              </div>

              {/* Target Inventory Asset */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-cyan-400" />
                  Target Inventory Asset
                </label>
                <select
                  value={inventoryId}
                  onChange={(e) => setInventoryId(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="">Select target VM / Cloud / K8s asset...</option>
                  {inventories.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.assetTag} • {i.provider} • {i.primaryIp || 'Cloud Asset'})
                    </option>
                  ))}
                </select>
                {inventories.length === 0 && (
                  <p className="text-[11px] text-amber-400/80 mt-1">
                    No inventory assets available yet. You can create inventory items in the Inventory tab or discover them from GCP.
                  </p>
                )}
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
                    <option value="READ_ONLY">Read-Only</option>
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
                    <option value={24}>24 Hours TTL (Full Day)</option>
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
                  onClick={() => {
                    setIsModalOpen(false);
                    resetRequestForm();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-50 rounded-xl shadow-lg shadow-brand-600/20 flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Access Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revocation Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!revokeTarget}
        onClose={() => {
          if (!isRevoking) {
            setRevokeTarget(null);
            setRevokeError(null);
          }
        }}
        onConfirm={handleConfirmRevoke}
        title="Revoke Privileged Access Grant"
        message="Are you sure you want to immediately revoke privileged access for this user on the target asset?"
        itemName={revokeTarget?.inventory?.name}
        itemTag={revokeTarget?.inventory?.assetTag}
        itemDetails={
          revokeTarget
            ? [
                { label: 'Staff Member', value: revokeTarget.employee ? `${revokeTarget.employee.firstName} ${revokeTarget.employee.lastName}` : 'N/A' },
                { label: 'Access Level', value: revokeTarget.accessLevel },
                { label: 'Grant Type', value: revokeTarget.grantType },
                { label: 'Valid Until', value: revokeTarget.validUntil ? new Date(revokeTarget.validUntil).toLocaleString() : 'N/A' },
              ]
            : []
        }
        confirmLabel="Revoke Access"
        cancelLabel="Keep Active"
        isLoading={isRevoking}
        errorMessage={revokeError}
        variant="danger"
      />

      {/* Single Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => {
          if (!isDeleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Access Grant"
        message="Are you sure you want to permanently delete this access grant record from the audit registry?"
        itemName={deleteTarget?.inventory?.name}
        itemTag={deleteTarget?.inventory?.assetTag}
        itemDetails={
          deleteTarget
            ? [
                { label: 'Staff Member', value: deleteTarget.employee ? `${deleteTarget.employee.firstName} ${deleteTarget.employee.lastName}` : 'N/A' },
                { label: 'Status', value: deleteTarget.status },
                { label: 'Access Level', value: deleteTarget.accessLevel },
              ]
            : []
        }
        confirmLabel="Delete Record"
        isLoading={isDeleting}
        errorMessage={deleteError}
        variant="danger"
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => {
          if (!isBulkDeleting) {
            setIsBulkDeleteModalOpen(false);
            setBulkDeleteError(null);
          }
        }}
        onConfirm={handleConfirmBulkDelete}
        title="Delete Selected Access Grants"
        message={`Are you sure you want to permanently delete ${selectedIds.length} selected access grant record(s)?`}
        confirmLabel={`Delete ${selectedIds.length} Grants`}
        isLoading={isBulkDeleting}
        errorMessage={bulkDeleteError}
        variant="danger"
      />
    </div>
  );
};
