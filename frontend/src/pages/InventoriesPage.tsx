import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { InventoryItem, Client, Project, AssetScope, AssetType, CloudProvider } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { JsonModal } from '@/components/common/JsonModal';
import { CloudImportModal } from '@/components/common/CloudImportModal';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import {
  Server,
  Plus,
  Search,
  Code2,
  Globe,
  Edit3,
  X,
  Save,
  Cloud,
  Trash2,
} from 'lucide-react';

export const InventoriesPage: React.FC = () => {
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');

  // Filters
  const [scopeFilter, setScopeFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCloudImportOpen, setIsCloudImportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedJson, setSelectedJson] = useState<{ title: string; data: any } | null>(null);

  // Custom Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [assetScope, setAssetScope] = useState<AssetScope>('CLIENT');
  const [assetType, setAssetType] = useState<AssetType>('VIRTUAL_MACHINE');
  const [provider, setProvider] = useState<CloudProvider>('GCP');
  const [region, setRegion] = useState('asia-southeast2');
  const [primaryIp, setPrimaryIp] = useState('10.140.0.10');
  const [clientId, setClientId] = useState('');

  const resetCreateForm = () => {
    setName('');
    setAssetTag('');
    setAssetScope('CLIENT');
    setAssetType('VIRTUAL_MACHINE');
    setProvider('GCP');
    setRegion('asia-southeast2');
    setPrimaryIp('10.140.0.10');
    setClientId(clients[0]?.id || '');
  };

  const loadData = () => {
    api.getInventories().then(setInventories);
    api.getClients().then(setClients);
    api.getProjects().then(setProjects);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !assetTag) return;

    const created = await api.createInventory({
      name,
      assetTag,
      assetScope,
      assetType,
      provider,
      region,
      primaryIp,
      clientId: assetScope === 'CLIENT' ? clientId || clients[0]?.id : undefined,
      specs: { cpu_cores: 8, ram_gb: 32, disk_gb: 200, os: 'Ubuntu 24.04 LTS' },
      connectionInfo: { ssh_port: 22, bastion_required: true },
    });

    setInventories((prev) => [created, ...prev]);
    setIsCreateOpen(false);
    resetCreateForm();
    await loadData();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const updated = await api.updateInventory(editingItem.id, editingItem);
    setInventories((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    );
    setEditingItem(null);
    await loadData();
  };

  const handleDeleteClick = (item: InventoryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteTarget(item);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    const res = await api.deleteInventory(deleteTarget.id);
    setIsDeleting(false);
    if (res.success) {
      setInventories((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      if (editingItem?.id === deleteTarget.id) {
        setEditingItem(null);
      }
      setDeleteTarget(null);
      await loadData();
    } else {
      setDeleteError(res.error || 'Failed to delete inventory asset');
    }
  };

  const filtered = inventories.filter((inv) => {
    let match = true;
    if (scopeFilter !== 'ALL') match = match && inv.assetScope === scopeFilter;
    if (typeFilter !== 'ALL') match = match && inv.assetType === typeFilter;
    if (providerFilter !== 'ALL') match = match && inv.provider === providerFilter;
    if (statusFilter !== 'ALL') match = match && inv.status === statusFilter;
    if (search) {
      const s = search.toLowerCase();
      match =
        match &&
        (inv.name.toLowerCase().includes(s) ||
          inv.assetTag.toLowerCase().includes(s) ||
          inv.region.toLowerCase().includes(s) ||
          (inv.primaryIp || '').includes(s));
    }
    return match;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            Inventory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Infrastructure assets across cloud providers, on-premise servers, and VPN networks. Click any row to edit.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setIsCloudImportOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-2 transition-all"
          >
            <Cloud className="w-4 h-4 text-brand-400" />
            Import from Cloud
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Register Asset
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by hostname, IP address, tag, or region..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Scopes</option>
            <option value="CLIENT">Client Assets</option>
            <option value="INTERNAL">Internal Assets</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Types</option>
            <option value="VIRTUAL_MACHINE">Virtual Machine</option>
            <option value="KUBERNETES">Kubernetes</option>
            <option value="DATABASE">Database</option>
            <option value="VPN_GATEWAY">VPN Gateway</option>
            <option value="CLOUD_ACCOUNT">Cloud Account</option>
          </select>

          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Providers</option>
            <option value="GCP">Google Cloud (GCP)</option>
            <option value="AWS">Amazon AWS</option>
            <option value="ALI_CLOUD">Alibaba Cloud</option>
            <option value="DIGITAL_OCEAN">DigitalOcean</option>
            <option value="ON_PREMISE">On-Premise / Bare Metal</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="MAINTENANCE">MAINTENANCE</option>
            <option value="PROVISIONING">PROVISIONING</option>
            <option value="DECOMMISSIONED">DECOMMISSIONED</option>
            <option value="ISOLATED">ISOLATED</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Asset Tag & Hostname</th>
                <th className="px-4 py-3.5">Scope & Owner</th>
                <th className="px-4 py-3.5">Type & Provider</th>
                <th className="px-4 py-3.5">Network & Region</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setEditingItem({ ...item })}
                  className="hover:bg-slate-900/60 cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-emerald-400 font-bold">
                        {item.assetTag}
                      </span>
                      <span className="text-[10px] text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold flex items-center gap-1">
                        <Edit3 className="w-3 h-3" /> Edit
                      </span>
                    </div>
                    <span className="font-bold text-white text-xs block mt-0.5 group-hover:text-emerald-400 transition-colors">
                      {item.name}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={item.assetScope} />
                      <span className="text-slate-400 text-xs truncate max-w-[160px]">
                        {item.client?.name || 'Internal MSP'}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={item.provider} />
                      <span className="font-mono text-slate-300 text-xs">
                        {item.assetType.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <p className="font-mono text-slate-200 text-xs font-semibold">{item.primaryIp || 'N/A'}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-500" />
                      {item.region}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge status={item.status} />
                  </td>

                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedJson({
                            title: `JSON Specs: ${item.name}`,
                            data: {
                              specs: item.specs,
                              connectionInfo: item.connectionInfo,
                              tags: item.tags,
                            },
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-medium text-xs inline-flex items-center gap-1.5 transition-colors"
                        title="View JSON Specs"
                      >
                        <Code2 className="w-3.5 h-3.5 text-brand-400" />
                        Specs
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(item, e)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 text-xs inline-flex items-center transition-colors"
                        title={`Delete asset ${item.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Inventory Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-xl rounded-2xl p-6 border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-400" />
                Edit Asset: {editingItem.name}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Asset Hostname / Identifier</label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Asset Tag</label>
                  <input
                    type="text"
                    required
                    value={editingItem.assetTag}
                    onChange={(e) => setEditingItem({ ...editingItem, assetTag: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                  <select
                    value={editingItem.status}
                    onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="PROVISIONING">PROVISIONING</option>
                    <option value="DECOMMISSIONED">DECOMMISSIONED</option>
                    <option value="ISOLATED">ISOLATED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Scope</label>
                  <select
                    value={editingItem.assetScope}
                    onChange={(e) => setEditingItem({ ...editingItem, assetScope: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="CLIENT">Client Dedicated</option>
                    <option value="INTERNAL">Internal MSP Asset</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Asset Type</label>
                  <select
                    value={editingItem.assetType}
                    onChange={(e) => setEditingItem({ ...editingItem, assetType: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="VIRTUAL_MACHINE">Virtual Machine</option>
                    <option value="KUBERNETES">Kubernetes Cluster</option>
                    <option value="DATABASE">Database Cluster</option>
                    <option value="VPN_GATEWAY">VPN Gateway</option>
                    <option value="CLOUD_ACCOUNT">Cloud Account</option>
                    <option value="STORAGE_BUCKET">Storage Bucket</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Provider</label>
                  <select
                    value={editingItem.provider}
                    onChange={(e) => setEditingItem({ ...editingItem, provider: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="GCP">Google Cloud (GCP)</option>
                    <option value="AWS">Amazon AWS</option>
                    <option value="ALI_CLOUD">Alibaba Cloud</option>
                    <option value="DIGITAL_OCEAN">DigitalOcean</option>
                    <option value="ON_PREMISE">On-Premise / Metal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Region</label>
                  <input
                    type="text"
                    value={editingItem.region}
                    onChange={(e) => setEditingItem({ ...editingItem, region: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Primary IP Address</label>
                <input
                  type="text"
                  value={editingItem.primaryIp || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, primaryIp: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleDeleteClick(editingItem)}
                  className="px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Asset
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-600/20"
                  >
                    Save Asset
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JSON Specs Viewer Modal */}
      {selectedJson && (
        <JsonModal
          isOpen={true}
          onClose={() => setSelectedJson(null)}
          title={selectedJson.title}
          data={selectedJson.data}
        />
      )}

      {/* Create Asset Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-400" />
                Register Inventory Asset
              </h3>
              <button onClick={() => { setIsCreateOpen(false); resetCreateForm(); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Asset Hostname / Identifier</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. k8s-worker-prod-01"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Asset Tag</label>
                  <input
                    type="text"
                    required
                    placeholder="INV-GCP-VM-01"
                    value={assetTag}
                    onChange={(e) => setAssetTag(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Asset Scope</label>
                  <select
                    value={assetScope}
                    onChange={(e) => setAssetScope(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="CLIENT">Client Dedicated</option>
                    <option value="INTERNAL">Internal MSP Asset</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Asset Type</label>
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="VIRTUAL_MACHINE">Virtual Machine (VM)</option>
                    <option value="KUBERNETES">Kubernetes Cluster</option>
                    <option value="DATABASE">Database Cluster</option>
                    <option value="VPN_GATEWAY">VPN Gateway</option>
                    <option value="CLOUD_ACCOUNT">Cloud Account</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Cloud Provider</label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="GCP">Google Cloud Platform (GCP)</option>
                    <option value="AWS">Amazon Web Services (AWS)</option>
                    <option value="ALI_CLOUD">Alibaba Cloud</option>
                    <option value="DIGITAL_OCEAN">DigitalOcean</option>
                    <option value="ON_PREMISE">On-Premise / Datacenter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Region</label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Primary IP</label>
                  <input
                    type="text"
                    value={primaryIp}
                    onChange={(e) => setPrimaryIp(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {assetScope === 'CLIENT' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Client Owner</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cloud Provider Import Wizard Dialog */}
      <CloudImportModal
        isOpen={isCloudImportOpen}
        onClose={() => setIsCloudImportOpen(false)}
        clients={clients}
        onImportComplete={loadData}
      />

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
        title="Delete Inventory Asset"
        message="Are you sure you want to permanently delete this infrastructure resource from the CMDB? This action cannot be undone."
        itemName={deleteTarget?.name}
        itemTag={deleteTarget?.assetTag}
        itemDetails={
          deleteTarget
            ? [
                { label: 'Provider', value: deleteTarget.provider },
                { label: 'Primary IP', value: deleteTarget.primaryIp || 'N/A' },
                { label: 'Asset Type', value: deleteTarget.assetType },
                { label: 'Environment', value: deleteTarget.environment },
              ]
            : []
        }
        confirmLabel="Delete Asset"
        isLoading={isDeleting}
        errorMessage={deleteError}
        variant="danger"
      />
    </div>
  );
};
