import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { InventoryItem, Client, Project, AssetScope, AssetType, CloudProvider } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { JsonModal } from '@/components/common/JsonModal';
import {
  Server,
  Plus,
  Search,
  Filter,
  Code2,
  Cpu,
  Layers,
  Globe,
  Radio,
  Building,
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

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedJson, setSelectedJson] = useState<{ title: string; data: any } | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [assetScope, setAssetScope] = useState<AssetScope>('CLIENT');
  const [assetType, setAssetType] = useState<AssetType>('VIRTUAL_MACHINE');
  const [provider, setProvider] = useState<CloudProvider>('GCP');
  const [region, setRegion] = useState('asia-southeast2');
  const [primaryIp, setPrimaryIp] = useState('10.140.0.10');
  const [clientId, setClientId] = useState('');

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

    await api.createInventory({
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

    setIsCreateOpen(false);
    setName('');
    setAssetTag('');
    loadData();
  };

  const filtered = inventories.filter((inv) => {
    let match = true;
    if (scopeFilter !== 'ALL') match = match && inv.assetScope === scopeFilter;
    if (typeFilter !== 'ALL') match = match && inv.assetType === typeFilter;
    if (providerFilter !== 'ALL') match = match && inv.provider === providerFilter;
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
            Unified CMDB Infrastructure Inventory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Single-table multi-cloud CMDB managing VMs, Cloud Accounts, Kubernetes, and VPN Tunnels.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Register CMDB Asset
        </button>
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
                <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="px-5 py-4">
                    <span className="font-mono text-[10px] text-emerald-400 font-bold block">
                      {item.assetTag}
                    </span>
                    <span className="font-bold text-white text-xs">{item.name}</span>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.assetScope} />
                      <span className="text-slate-400 text-xs truncate max-w-[140px]">
                        {item.client?.name || 'Internal MSP'}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
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
                    <button
                      onClick={() =>
                        setSelectedJson({
                          title: `JSON Specs: ${item.name}`,
                          data: {
                            specs: item.specs,
                            connectionInfo: item.connectionInfo,
                            tags: item.tags,
                          },
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-medium text-xs flex items-center gap-1.5 ml-auto transition-colors"
                    >
                      <Code2 className="w-3.5 h-3.5 text-brand-400" />
                      Inspect Specs
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-400" />
              Register Unified CMDB Asset
            </h3>
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
                  onClick={() => setIsCreateOpen(false)}
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
    </div>
  );
};
