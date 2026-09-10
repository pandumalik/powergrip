import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Client, CloudProvider, CloudCredential } from '@/types';
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
  FileCode,
  Sparkles,
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
  sourceCredentialName?: string;
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
  const [sourceMode, setSourceMode] = useState<'saved' | 'upload'>('saved');

  // Saved credentials selection
  const [savedCredentials, setSavedCredentials] = useState<CloudCredential[]>([]);
  const [selectedCredIds, setSelectedCredIds] = useState<string[]>([]);
  const [isLoadingCreds, setIsLoadingCreds] = useState(false);

  // Manual upload state
  const [provider, setProvider] = useState<CloudProvider>('GCP');
  const [saKeyJson, setSaKeyJson] = useState('');
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [uploadedBlobs, setUploadedBlobs] = useState<Array<{ name: string; blob: any; provider: CloudProvider }>>([]);
  const [saveUploadedKeysToVault, setSaveUploadedKeysToVault] = useState(true);

  // Discovery progress
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Discovery Results
  const [discoveryResult, setDiscoveryResult] = useState<{
    projectIds: string[];
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
    setSourceMode('saved');
    setProvider('GCP');
    setSaKeyJson('');
    setFileNames([]);
    setUploadedBlobs([]);
    setSaveUploadedKeysToVault(true);
    setIsScanning(false);
    setErrorMsg('');
    setDiscoveryResult(null);
    setSelectedIds([]);
    setAssetScope('CLIENT');
    setSelectedClientId(clients[0]?.id || '');
    setFilterType('ALL');
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (isOpen) {
      setIsLoadingCreds(true);
      api
        .getCloudCredentials()
        .then((creds) => {
          setSavedCredentials(creds);
          if (creds.length > 0) {
            setSourceMode('saved');
            setSelectedCredIds([creds[0].id]);
          } else {
            setSourceMode('upload');
          }
        })
        .finally(() => setIsLoadingCreds(false));
    } else {
      resetState();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Handle Multi-file Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg('');
    const newBlobs: typeof uploadedBlobs = [];
    const names: string[] = [];

    Array.from(files).forEach((file) => {
      names.push(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        try {
          const parsed = JSON.parse(content);
          let detProv: CloudProvider = provider;
          if (parsed.type === 'service_account' || parsed.private_key_id) detProv = 'GCP';
          else if (parsed.aws_access_key_id || parsed.access_key_id) detProv = 'AWS';

          newBlobs.push({ name: file.name, blob: parsed, provider: detProv });
          if (newBlobs.length === files.length) {
            setUploadedBlobs(newBlobs);
            setFileNames(names);
            if (newBlobs.length === 1) {
              setSaKeyJson(content);
            }
          }
        } catch {
          setErrorMsg(`File "${file.name}" is not valid JSON.`);
        }
      };
      reader.readAsText(file);
    });
  };

  // Toggle selection for saved credentials
  const toggleCredSelection = (id: string) => {
    setSelectedCredIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  // Run Multi-Account Discovery
  const handleDiscover = async () => {
    setIsScanning(true);
    setErrorMsg('');

    try {
      const allDiscoveredResources: DiscoveredAsset[] = [];
      const projectIds: string[] = [];
      let totalDuplicates = 0;

      if (sourceMode === 'saved') {
        if (selectedCredIds.length === 0) {
          setErrorMsg('Please select at least 1 saved Service Account to scan.');
          setIsScanning(false);
          return;
        }

        const credsToScan = savedCredentials.filter((c) => selectedCredIds.includes(c.id));

        for (const cred of credsToScan) {
          try {
            const res = await api.discoverCloudAssets(cred.provider, cred.keyBlob);
            if (res.projectId && !projectIds.includes(res.projectId)) projectIds.push(res.projectId);
            totalDuplicates += res.duplicateCount || 0;

            const tagged = (res.resources || []).map((r) => ({
              ...r,
              sourceCredentialName: cred.name,
            }));
            allDiscoveredResources.push(...tagged);
          } catch (scanErr: any) {
            console.warn(`Discovery failed for ${cred.name}`, scanErr);
          }
        }
      } else {
        // Upload Mode
        let blobsToScan = uploadedBlobs;
        if (blobsToScan.length === 0 && saKeyJson.trim()) {
          try {
            const parsed = JSON.parse(saKeyJson);
            blobsToScan = [{ name: 'manual-sa-key.json', blob: parsed, provider }];
          } catch {
            setErrorMsg('Invalid Credentials JSON format. Please verify JSON syntax.');
            setIsScanning(false);
            return;
          }
        }

        if (blobsToScan.length === 0) {
          setErrorMsg('Please upload or paste at least 1 Service Account Key JSON.');
          setIsScanning(false);
          return;
        }

        // Optionally save to vault
        if (saveUploadedKeysToVault) {
          try {
            await api.batchImportCloudCredentials(
              blobsToScan.map((b) => ({
                name: b.name,
                provider: b.provider,
                keyBlob: b.blob,
                clientId: selectedClientId || undefined,
              })),
            );
          } catch (saveErr) {
            console.warn('Could not auto-save keys to vault', saveErr);
          }
        }

        for (const item of blobsToScan) {
          const res = await api.discoverCloudAssets(item.provider, item.blob);
          if (res.projectId && !projectIds.includes(res.projectId)) projectIds.push(res.projectId);
          totalDuplicates += res.duplicateCount || 0;

          const tagged = (res.resources || []).map((r) => ({
            ...r,
            sourceCredentialName: item.name,
          }));
          allDiscoveredResources.push(...tagged);
        }
      }

      if (allDiscoveredResources.length === 0) {
        throw new Error('No cloud resources found in the scanned accounts. Check API permissions.');
      }

      setDiscoveryResult({
        projectIds,
        discoveredCount: allDiscoveredResources.length,
        duplicateCount: totalDuplicates,
        resources: allDiscoveredResources,
      });

      // Default select non-duplicates
      const nonDuplicates = allDiscoveredResources.filter((r) => !r.isDuplicate).map((r) => r.candidateId);
      setSelectedIds(nonDuplicates);

      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate and discover cloud resources.');
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
        tags: [r.provider, 'Auto-Imported', r.sourceCredentialName || 'Cloud'],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="glass-panel w-full max-w-4xl rounded-3xl p-6 border border-slate-700 shadow-2xl max-h-[92vh] flex flex-col justify-between">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
                <Cloud className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Multi-Account Cloud Discovery & Import
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">
                    Step {step} of 2
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  {step === 1
                    ? 'Scan saved Service Account keys or upload new key blobs to discover cloud assets.'
                    : 'Review discovered resources across accounts, validate duplicates, and assign ownership.'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl transition-colors hover:bg-slate-800"
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

          {/* STEP 1: Select Saved Keys or Upload */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Source Mode Toggle */}
              <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
                <button
                  type="button"
                  onClick={() => setSourceMode('saved')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    sourceMode === 'saved'
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Use Saved Cloud Keys ({savedCredentials.length})
                </button>

                <button
                  type="button"
                  onClick={() => setSourceMode('upload')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    sourceMode === 'upload'
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload New Key File(s)
                </button>
              </div>

              {/* Option A: Saved Service Accounts Selection */}
              {sourceMode === 'saved' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      Select Service Accounts to Scan ({selectedCredIds.length} of {savedCredentials.length} selected):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedCredIds.length === savedCredentials.length) setSelectedCredIds([]);
                        else setSelectedCredIds(savedCredentials.map((c) => c.id));
                      }}
                      className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold"
                    >
                      {selectedCredIds.length === savedCredentials.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {savedCredentials.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
                      <KeyRound className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-white">No Saved Service Accounts in Vault</p>
                      <p className="text-[11px] text-slate-400 mt-1 mb-3">
                        Switch to "Upload New Key File(s)" to scan and save your first key.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSourceMode('upload')}
                        className="px-3 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-semibold"
                      >
                        Upload Key File
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto pr-1">
                      {savedCredentials.map((cred) => {
                        const isChecked = selectedCredIds.includes(cred.id);
                        return (
                          <div
                            key={cred.id}
                            onClick={() => toggleCredSelection(cred.id)}
                            className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                              isChecked
                                ? 'bg-brand-500/10 border-brand-500 shadow-md shadow-brand-500/10'
                                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <button type="button" className="mt-0.5 text-brand-400">
                              {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-500" />}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                <StatusBadge status={cred.provider} />
                                <span className="text-xs font-bold text-white truncate">{cred.name}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono truncate">
                                Proj: {cred.metadata?.projectId || 'N/A'}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">
                                {cred.metadata?.accountEmail}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Option B: Direct Key Upload */}
              {sourceMode === 'upload' && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-slate-700 hover:border-brand-500/60 bg-slate-900/40 rounded-2xl p-5 text-center transition-all relative cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept=".json,.txt"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Upload className="w-6 h-6 text-brand-400" />
                      <p className="text-xs font-bold text-white">
                        Click or drag & drop single or <span className="text-emerald-400">multiple *.json key files</span>
                      </p>
                      {fileNames.length > 0 && (
                        <p className="text-[11px] font-mono text-emerald-400">
                          Loaded: {fileNames.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Raw JSON Paste Area */}
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Or paste raw credentials JSON directly:</span>
                    <textarea
                      rows={3}
                      placeholder='{"type": "service_account", "project_id": "my-gcp-project-123", "private_key_id": "...", ...}'
                      value={saKeyJson}
                      onChange={(e) => setSaKeyJson(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="saveVaultCheck"
                      checked={saveUploadedKeysToVault}
                      onChange={(e) => setSaveUploadedKeysToVault(e.target.checked)}
                      className="rounded border-slate-700 text-brand-600 focus:ring-brand-500"
                    />
                    <label htmlFor="saveVaultCheck" className="text-xs text-slate-300 font-medium cursor-pointer">
                      Automatically store these keys in the Service Account Vault for periodic re-scanning
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Discovery Review, Duplicate Validation, and Assignment */}
          {step === 2 && discoveryResult && (
            <div className="space-y-4">
              {/* Project & Discovery Stats Pill */}
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Projects:</span>
                  {discoveryResult.projectIds.map((p) => (
                    <span key={p} className="font-mono font-bold text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                      {p}
                    </span>
                  ))}
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
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
              <div className="rounded-2xl border border-slate-800 overflow-hidden max-h-[280px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 w-10 text-center">Select</th>
                      <th className="px-4 py-2.5">Resource & Account</th>
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
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mt-0.5">
                              <span>{res.assetTag}</span>
                              {res.sourceCredentialName && (
                                <>
                                  <span>•</span>
                                  <span className="text-brand-400 truncate max-w-[120px]">{res.sourceCredentialName}</span>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <StatusBadge status={res.assetType} />
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {res.assetType === 'VIRTUAL_MACHINE' && `${res.specs.cpu_cores || 4} vCPU • ${res.specs.ram_gb || 16}GB RAM`}
                              {res.assetType === 'DATABASE' && `${res.specs.engine || 'CloudSQL'} • ${res.specs.disk_gb || 100}GB`}
                              {res.assetType === 'KUBERNETES' && `${res.specs.k8s_version || 'GKE'} • ${res.specs.total_nodes || 3} Nodes`}
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
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-4">
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
                disabled={
                  isScanning ||
                  (sourceMode === 'saved' && selectedCredIds.length === 0) ||
                  (sourceMode === 'upload' && uploadedBlobs.length === 0 && !saKeyJson.trim())
                }
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
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Account Selection
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
