import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Client } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
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
} from 'lucide-react';

export const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Create Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [industry, setIndustry] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [country, setCountry] = useState('Indonesia');
  const [city, setCity] = useState('Jakarta');

  const loadClients = () => {
    api.getClients().then(setClients);
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;
    await api.createClient({ name, code, industry, billingEmail, country, city });
    setIsCreateOpen(false);
    setName('');
    setCode('');
    loadClients();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    await api.updateClient(editingClient.id, editingClient);
    setEditingClient(null);
    loadClients();
  };

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.country.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-400" />
            Clients
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage multi-tenant corporate clients, global operating sites, and signed SLAs. Click any card to edit.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Onboard New Client
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Search by client name, code (CLI-...), or country..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      {/* Client Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filtered.map((client) => (
          <div
            key={client.id}
            onClick={() => setEditingClient({ ...client })}
            className="glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col justify-between cursor-pointer group border border-slate-800 hover:border-brand-500/40 transition-all duration-200"
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between">
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
                  <p className="text-xs text-slate-400">{client.industry}</p>
                </div>
                <StatusBadge status={client.status} />
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
        ))}
      </div>

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Industry</label>
                  <input
                    type="text"
                    value={editingClient.industry || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, industry: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
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

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
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
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
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
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Industry</label>
                  <input
                    type="text"
                    placeholder="Financial Services"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
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
                  onClick={() => setIsCreateOpen(false)}
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
    </div>
  );
};
