import React, { useState } from 'react';
import { api } from '@/services/api';
import { Client, CloudProvider } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  Cloud,
  X,
  Upload,
  Server,
  Database,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Layers,
  Building,
  ShieldAlert,
  Loader2,
  CheckSquare,
  Square,
  ArrowRight,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';

interface DiscoveredAsset {
  candidateId: string;
  name: string;
  assetTag: string;
  assetType: 'VIRTUAL_MACHINE' | 'DATABASE' | 'KUBERNETES';
  provider: CloudProvider;
  region: string;
  zone?: string;
  primaryIp: string;
  specs: Record<string, any>;
  cloudMetadata: Record<string, any>;
  isDuplicate: boolean;
  duplicateReason?: string;
  existingAssetTag?: string;
  existingId?: string;
}

interface CloudImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onImportComplete: () => void;
}

export const CloudImportModal: React.FC<CloudImportModalProps> = ({
  isOpen,
  onClose,
  clients,
  onImportComplete,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [provider, setProvider] = useState<CloudProvider>('GCP');
  const [saKeyJson, setSaKeyJson] = useState('');
  const [fileName, setFileName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Discovery Results
  const [discoveryResult, setDiscoveryResult] = useState<{
    projectId?: string;
    accountEmail?: string;
    discoveredCount: number;
    duplicateCount: number;
    resources: DiscoveredAsset[];
  } | null>(null);

  // Selection & Assignment
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assetScope, setAssetScope] = useState<'CLIENT' | 'INTERNAL'>('CLIENT');
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || '');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetState = () => {
    setStep(1);
    setProvider('GCP');
    setSaKeyJson('');
    setFileName('');
    setIsScanning(false);
    setErrorMsg('');
    setDiscoveryResult(null);
    setSelectedIds([]);
    setAssetScope('CLIENT');
    setSelectedClientId(clients[0]?.id || '');
    setFilterType('ALL');
    setIsSubmitting(false);
  };

  React.useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setSaKeyJson(content);
    };
    reader.readAsText(file);
  };

  // Run Discovery
  const handleDiscover = async () => {
    if (!saKeyJson.trim()) {
      setErrorMsg('Please upload or paste your Service Account Key JSON.');
      return;
    }

    setIsScanning(true);
    setErrorMsg('');

    try {
      const result = await api.discoverCloudAssets(provider, saKeyJson);
      setDiscoveryResult(result);

      // Default select all non-duplicate resources
      const nonDuplicates = result.resources.filter((r) => !r.isDuplicate).map((r) => r.candidateId);
      setSelectedIds(nonDuplicates);

      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate and discover cloud resources. Verify key format.');
    } finally {
      setIsScanning(false);
    }
  };

  // Toggle selection for an item
  const toggleSelect = (id: string, isDuplicate: boolean) => {
    if (isDuplicate) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  // Toggle all available non-duplicates
  const toggleSelectAll = () => {
    if (!discoveryResult) return;
    const nonDuplicates = discoveryResult.resources
      .filter((r) => !r.isDuplicate && (filterType === 'ALL' || r.assetType === filterType))
      .map((r) => r.candidateId);

    const allSelected = nonDuplicates.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !nonDuplicates.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...nonDuplicates])));
    }
  };

  // Submit Bulk Import
  const handleImportSubmit = async () => {
    if (!discoveryResult) return;
    const itemsToImport = discoveryResult.resources
      .filter((r) => selectedIds.includes(r.candidateId))
      .map((r) => ({
        name: r.name,
        assetTag: r.assetTag,
        assetScope,
        assetType: r.assetType,
        provider: r.provider,
        region: r.region,
        primaryIp: r.primaryIp,
        clientId: assetScope === 'CLIENT' ? selectedClientId || clients[0]?.id : undefined,
        specs: r.specs,
        cloudMetadata: r.cloudMetadata,
        tags: [r.provider, 'Auto-Imported', discoveryResult.projectId || 'Cloud'],
      }));

    if (itemsToImport.length === 0) {
      setErrorMsg('Please select at least 1 resource to import.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.bulkImportInventories({ items: itemsToImport });
      onImportComplete();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import inventory assets.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredResources = (discoveryResult?.resources || []).filter(
    (r) => filterType === 'ALL' || r.assetType === filterType,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="glass-panel w-full max-w-4xl rounded-2xl p-6 border border-slate-700 shadow-2xl max-h-[90vh] flex flex-col justify-between">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Cloud className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Cloud Infrastructure Discovery & Import
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">
                    Step {step} of 2
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  {step === 1
                    ? 'Upload your Service Account Key to authenticate and scan cloud infrastructure.'
                    : 'Review discovered resources, validate duplicate records, and assign ownership.'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* STEP 1: Provider Selection & SA Key Upload */}
          {step === 1 && (
            <div className="space-y-5">
              {/* 1. Select Cloud Provider */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  1. Select Target Cloud Provider
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'GCP' as CloudProvider, name: 'Google Cloud (GCP)', desc: 'Service Account JSON Key (Compute, CloudSQL, GKE)' },
                    { id: 'AWS' as CloudProvider, name: 'Amazon Web Services (AWS)', desc: 'IAM Access Key / Role Credentials (EC2, RDS, EKS)' },
                    { id: 'ALI_CLOUD' as CloudProvider, name: 'Alibaba Cloud', desc: 'RAM AccessKey & Resource Discovery' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        provider === p.id
                          ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/10'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xs font-bold text-white block">{p.name}</span>
                      <span className="text-[10px] text-slate-400 block mt-1 leading-snug">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Upload SA Key */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                  <span>2. Upload or Paste Service Account Key (<code className="text-emerald-400 font-mono">sa-key.json</code>)</span>
                  {fileName && <span className="text-emerald-400 font-mono text-[10px]">Loaded: {fileName}</span>}
                </label>

                {/* File Dropzone */}
                <div className="border-2 border-dashed border-slate-700 hover:border-brand-500/60 bg-slate-900/40 rounded-2xl p-6 text-center transition-all relative cursor-pointer">
                  <input
                    type="file"
                    accept=".json,.txt"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Click or drag & drop your <span className="text-emerald-400">sa-key.json</span> here</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Supports official Google Cloud Platform IAM Service Account Key files</p>
                    </div>
                  </div>
                </div>

                {/* Raw Paste Textarea */}
                <div className="mt-3">
                  <span className="text-[11px] text-slate-400 block mb-1">Or paste raw credentials JSON directly:</span>
                  <textarea
                    rows={4}
                    placeholder='{"type": "service_account", "project_id": "my-gcp-project-123", "private_key_id": "...", ...}'
                    value={saKeyJson}
                    onChange={(e) => setSaKeyJson(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Discovery Review, Duplicate Validation, and Assignment */}
          {step === 2 && discoveryResult && (
            <div className="space-y-4">
              {/* Project & Discovery Stats Pill */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">Project:</span>
                  <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {discoveryResult.projectId}
                  </span>
                  <span className="text-slate-400 hidden sm:inline">•</span>
                  <span className="text-slate-400 hidden sm:inline truncate max-w-[200px]" title={discoveryResult.accountEmail}>
                    SA: {discoveryResult.accountEmail}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                    {discoveryResult.discoveredCount} Discovered
                  </span>
                  {discoveryResult.duplicateCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {discoveryResult.duplicateCount} Existing / Duplicate
                    </span>
                  )}
                </div>
              </div>

              {/* Ownership Assignment Bar */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Building className="w-4 h-4 text-brand-400" />
                  <span>Assign Imported Assets To:</span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select
                    value={assetScope}
                    onChange={(e) => setAssetScope(e.target.value as any)}
                    className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-500 font-semibold"
                  >
                    <option value="CLIENT">Client Infrastructure</option>
                    <option value="INTERNAL">Internal / Vendor Infrastructure</option>
                  </select>

                  {assetScope === 'CLIENT' && (
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="flex-1 sm:w-60 bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-500 font-semibold"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Filter Tabs & Select All */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                  {['ALL', 'VIRTUAL_MACHINE', 'DATABASE', 'KUBERNETES'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFilterType(type)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                        filterType === type ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {type === 'ALL' ? 'All Resources' : type.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Toggle All Available
                </button>
              </div>

              {/* Discovered Assets Selection Table */}
              <div className="rounded-xl border border-slate-800 overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 w-10 text-center">Select</th>
                      <th className="px-4 py-2.5">Resource Name & Tag</th>
                      <th className="px-4 py-2.5">Type & Specs</th>
                      <th className="px-4 py-2.5">Region & IP</th>
                      <th className="px-4 py-2.5 text-right">Validation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredResources.map((res) => {
                      const isSelected = selectedIds.includes(res.candidateId);
                      return (
                        <tr
                          key={res.candidateId}
                          onClick={() => toggleSelect(res.candidateId, res.isDuplicate)}
                          className={`transition-colors cursor-pointer ${
                            res.isDuplicate
                              ? 'opacity-50 bg-slate-950/40 cursor-not-allowed'
                              : isSelected
                              ? 'bg-brand-500/10 hover:bg-brand-500/15'
                              : 'hover:bg-slate-900/60'
                          }`}
                        >
                          <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={res.isDuplicate}
                              onClick={() => toggleSelect(res.candidateId, res.isDuplicate)}
                              className="text-slate-400 hover:text-white disabled:opacity-30"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-brand-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-bold text-white block text-xs">{res.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">{res.assetTag}</span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <StatusBadge status={res.assetType} />
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {res.assetType === 'VIRTUAL_MACHINE' && `${res.specs.cpu_cores} vCPU • ${res.specs.ram_gb}GB RAM`}
                              {res.assetType === 'DATABASE' && `${res.specs.engine} • ${res.specs.disk_gb}GB SSD`}
                              {res.assetType === 'KUBERNETES' && `${res.specs.k8s_version} • ${res.specs.total_nodes} Nodes`}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-slate-300 block">{res.primaryIp}</span>
                            <span className="text-[10px] text-slate-500 block">{res.region} ({res.zone || 'regional'})</span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            {res.isDuplicate ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold"
                                title={res.duplicateReason}
                              >
                                <AlertTriangle className="w-3 h-3" />
                                {res.duplicateReason || `Already Imported (${res.existingAssetTag})`}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> Ready to Import
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-5">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDiscover}
                disabled={isScanning || !saKeyJson.trim()}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 flex items-center gap-2 transition-all"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning Cloud Resources...
                  </>
                ) : (
                  <>
                    Scan & Discover Resources <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Credentials
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-medium">
                  <strong className="text-white">{selectedIds.length}</strong> resources selected
                </span>

                <button
                  type="button"
                  onClick={handleImportSubmit}
                  disabled={isSubmitting || selectedIds.length === 0}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 flex items-center gap-2 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing to Inventory...
                    </>
                  ) : (
                    <>
                      <Cloud className="w-4 h-4" />
                      Import Selected ({selectedIds.length})
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
