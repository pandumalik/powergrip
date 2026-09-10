import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Client } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SearchableCreatableSelect } from '@/components/common/SearchableCreatableSelect';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { BulkActionToolbar } from '@/components/common/BulkActionToolbar';
import {
  Building2,
  Plus,
  Search,
  FileText,
  MapPin,
  Mail,
  Calendar,
  DollarSign,
  ShieldCheck,
  Edit3,
  X,
  Save,
  Layers,
  Trash2,
} from 'lucide-react';

export const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('ALL');

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isIndustryModalOpen, setIsIndustryModalOpen] = useState(false);

  // Custom Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Industry Manager State
  const [newIndustryInput, setNewIndustryInput] = useState('');

  // Create Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [industry, setIndustry] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [country, setCountry] = useState('Indonesia');
  const [city, setCity] = useState('Jakarta');

  const resetCreateForm = () => {
    setName('');
    setCode('');
    setIndustry(industries[0] || '');
    setBillingEmail('');
    setCountry('Indonesia');
    setCity('Jakarta');
  };

  const loadData = async () => {
    const [cls, inds] = await Promise.all([api.getClients(), api.getIndustries()]);
    setClients(cls);
    setIndustries(inds);
    if (inds.length > 0 && !industry) {
      setIndustry(inds[0]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateIndustry = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newIndustryInput.trim()) return;
    const updated = await api.addIndustry(newIndustryInput.trim());
    setIndustries(updated);
    setNewIndustryInput('');
  };

  const handleDeleteIndustry = async (ind: string) => {
    const updated = await api.deleteIndustry(ind);
    setIndustries(updated);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;

    const selectedIndustry = (industry || industries[0] || 'General').trim();

    // Persist new category to MISC database table ONLY upon saving client
    if (selectedIndustry && !industries.includes(selectedIndustry)) {
      await api.addIndustry(selectedIndustry);
    }

    const created = await api.createClient({
      name,
      code,
      industry: selectedIndustry,
      billingEmail,
      country,
      city,
    });

    setClients((prev) => [created, ...prev]);
    setIsCreateOpen(false);
    resetCreateForm();
    await loadData();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    const selectedIndustry = (editingClient.industry || industries[0] || 'General').trim();

    // Persist new category to MISC database table ONLY upon saving client
    if (selectedIndustry && !industries.includes(selectedIndustry)) {
      await api.addIndustry(selectedIndustry);
    }

    const updated = await api.updateClient(editingClient.id, {
      ...editingClient,
      industry: selectedIndustry,
    });

    setClients((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
    );
    setEditingClient(null);
    await loadData();
  };

  const handleDeleteClick = (client: Client, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteTarget(client);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    const res = await api.deleteClient(deleteTarget.id);
    setIsDeleting(false);
    if (res.success) {
      setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      if (editingClient?.id === deleteTarget.id) {
        setEditingClient(null);
      }
      setDeleteTarget(null);
      await loadData();
    } else {
      setDeleteError(res.error || 'Failed to delete client account');
    }
  };

  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(filtered.map((c) => c.id));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    setBulkDeleteError(null);
    const res = await api.deleteClients(selectedIds);
    setIsBulkDeleting(false);
    if (res.success) {
      setClients((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      await loadData();
    } else {
      setBulkDeleteError(res.errors?.join(', ') || 'Failed to delete selected clients');
      await loadData();
    }
  };

  const filtered = clients.filter((c) => {
    let match = true;
    if (industryFilter !== 'ALL') {
      match = match && c.industry === industryFilter;
    }
    if (search) {
      const s = search.toLowerCase();
      match =
        match &&
        (c.name.toLowerCase().includes(s) ||
          c.code.toLowerCase().includes(s) ||
          (c.industry || '').toLowerCase().includes(s) ||
          c.country.toLowerCase().includes(s));
    }
    return match;
  });

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-400" />
            Clients
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
              {clients.length} Total
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage multi-tenant corporate clients, global operating sites, and signed SLAs. Click any card to edit.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsIndustryModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-2 transition-all"
          >
            <Layers className="w-4 h-4 text-purple-400" />
            Manage Industries ({industries.length})
          </button>

          <button
            onClick={() => {
              if (industries.length > 0 && !industry) {
                setIndustry(industries[0]);
              }
              setIsCreateOpen(true);
            }}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Onboard Client
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by client name, code (CLI-...), industry, or country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="bg-slate-900/80 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500 shrink-0"
        >
          <option value="ALL">All Industries ({industries.length})</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedIds.length}
        totalCount={filtered.length}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onDeleteSelected={() => setIsBulkDeleteModalOpen(true)}
        isAllSelected={selectedIds.length === filtered.length && filtered.length > 0}
        resourceName="clients"
        deleteLabel={`Delete Selected (${selectedIds.length})`}
      />

      {/* Client Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filtered.length === 0 ? (
          <div className="col-span-2 glass-panel rounded-2xl p-12 text-center text-slate-500 text-xs">
            No clients found matching search criteria. Click "Onboard Client" to add one.
          </div>
        ) : (
          filtered.map((client) => {
            const isSelected = selectedIds.includes(client.id);
            return (
              <div
                key={client.id}
                onClick={() => setEditingClient({ ...client })}
                className={`glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col justify-between cursor-pointer group border transition-all duration-200 ${
                  isSelected
                    ? 'border-brand-500/60 bg-brand-500/5 shadow-lg shadow-brand-500/10'
                    : 'border-slate-800 hover:border-brand-500/40'
                }`}
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className="pt-0.5"
                        onClick={(e) => handleToggleSelect(client.id, e)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-brand-500/30 cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {client.code}
                          </span>
                          <span className="text-[10px] text-brand-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                            <Edit3 className="w-3 h-3" /> Click to Edit
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white mt-1.5 group-hover:text-brand-400 transition-colors">
                          {client.name}
                        </h3>
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[11px] font-medium">
                          <Layers className="w-3 h-3" />
                          {client.industry || 'General Industry'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={client.status} />
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(client, e)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 text-xs inline-flex items-center transition-colors"
                        title={`Delete client ${client.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-xs text-slate-300">
                <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">
                    {client.city}, {client.country}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">{client.billingEmail}</span>
                </div>
              </div>

              {/* Active Contracts Sub-section */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-brand-400" />
                  Active Service Contracts & SLAs
                </h4>

                {client.contracts && client.contracts.length > 0 ? (
                  client.contracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200">{contract.title}</span>
                        <StatusBadge status={contract.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-emerald-400" />
                          ${Number(contract.value).toLocaleString()} {contract.currency}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-blue-400" />
                          {contract.startDate} to {contract.endDate}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400 font-medium">
                          <ShieldCheck className="w-3 h-3" />
                          {contract.slaLevel}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">No active contracts assigned.</p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Timezone: {client.timezone}</span>
              <span className="font-mono text-brand-400">ID: {client.id.slice(0, 8)}...</span>
            </div>
          </div>
        );
      })
    )}
  </div>

      {/* Industry Catalog Manager Modal (MISC Table) */}
      {isIndustryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                Industry Taxonomy Catalog (MISC)
              </h3>
              <button
                onClick={() => setIsIndustryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Standardized industry categories stored dynamically in the <code className="text-purple-300 font-mono">MISC (key: INDUSTRIES)</code> catalog.
            </p>

            {/* Add New Category Input */}
            <form onSubmit={handleCreateIndustry} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Enter new industry category name..."
                value={newIndustryInput}
                onChange={(e) => setNewIndustryInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-purple-600/20"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Category
              </button>
            </form>

            {/* Category List */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {industries.map((ind) => (
                <div
                  key={ind}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                >
                  <span className="font-semibold text-slate-200">{ind}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteIndustry(ind)}
                    className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setIsIndustryModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-xl rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-brand-400" />
                Edit Client: {editingClient.name}
              </h3>
              <button
                onClick={() => setEditingClient(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Company Legal Name</label>
                <input
                  type="text"
                  required
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Client Code</label>
                  <input
                    type="text"
                    required
                    value={editingClient.code}
                    onChange={(e) => setEditingClient({ ...editingClient, code: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Account Status</label>
                  <select
                    value={editingClient.status}
                    onChange={(e) => setEditingClient({ ...editingClient, status: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="PROSPECT">PROSPECT</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              {/* Searchable Creatable Industry Combobox */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Industry</label>
                  <span className="text-[11px] text-slate-400">Search or type new category</span>
                </div>
                <SearchableCreatableSelect
                  value={editingClient.industry || ''}
                  onChange={(val) => setEditingClient({ ...editingClient, industry: val })}
                  options={industries}
                  placeholder="Select or search industry..."
                  createLabel="➕ Select new category"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Billing Email</label>
                <input
                  type="email"
                  required
                  value={editingClient.billingEmail}
                  onChange={(e) => setEditingClient({ ...editingClient, billingEmail: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Country</label>
                  <input
                    type="text"
                    value={editingClient.country}
                    onChange={(e) => setEditingClient({ ...editingClient, country: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">City</label>
                  <input
                    type="text"
                    value={editingClient.city || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, city: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleDeleteClick(editingClient)}
                  className="px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Client
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingClient(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl"
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

      {/* Onboard Client Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-400" />
                Onboard New Enterprise Client
              </h3>
              <button onClick={() => { setIsCreateOpen(false); resetCreateForm(); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Company Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PT Global Fintech Mandiri"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Client Code</label>
                  <input
                    type="text"
                    required
                    placeholder="CLI-FINTECH"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Searchable Creatable Industry Combobox */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Industry</label>
                  <SearchableCreatableSelect
                    value={industry}
                    onChange={setIndustry}
                    options={industries}
                    placeholder="Search or type new..."
                    createLabel="➕ Select new category"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Billing Email</label>
                <input
                  type="email"
                  required
                  placeholder="billing@company.com"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsCreateOpen(false); resetCreateForm(); }}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-600/20"
                >
                  Create Client Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reusable Enterprise Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => {
          if (!isDeleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Client Account"
        message="Are you sure you want to permanently delete this client enterprise from the system?"
        itemName={deleteTarget?.name}
        itemTag={deleteTarget?.code}
        itemDetails={
          deleteTarget
            ? [
                { label: 'Industry', value: deleteTarget.industry || 'General' },
                { label: 'Country', value: deleteTarget.country || 'N/A' },
                { label: 'City', value: deleteTarget.city || 'N/A' },
                { label: 'Contracts', value: `${deleteTarget.contracts?.length || 0} active contracts` },
              ]
            : []
        }
        confirmLabel="Delete Client"
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
        title="Delete Selected Clients"
        message={`Are you sure you want to permanently delete ${selectedIds.length} selected client account(s)? Note: Deleting a client may fail if active projects or resources are attached.`}
        confirmLabel={`Delete ${selectedIds.length} Clients`}
        isLoading={isBulkDeleting}
        errorMessage={bulkDeleteError}
        variant="danger"
      />
    </div>
  );
};
