import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { CloudCredential, Client, CloudProvider, ReScanSummaryResult } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  KeyRound,
  X,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Plus,
  Loader2,
  FileCode,
  Zap,
  Check,
  ExternalLink,
} from 'lucide-react';

interface ServiceAccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onUpdated: () => void;
}

export const ServiceAccountManagerModal: React.FC<ServiceAccountManagerModalProps> = ({
  isOpen,
  onClose,
  clients,
  onUpdated,
}) => {
  const [credentials, setCredentials] = useState<CloudCredential[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');

  // Staged files for batch import
  const [stagedFiles, setStagedFiles] = useState<
    Array<{
      fileName: string;
      content: string;
      provider: CloudProvider;
      projectId: string;
      clientEmail: string;
    }>
  >([]);
  const [rawJsonPaste, setRawJsonPaste] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [defaultInterval, setDefaultInterval] = useState<string>('1h');
  const [isImporting, setIsImporting] = useState(false);

  // Scanning state
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [isScanningAll, setIsScanningAll] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCredentials = async () => {
    setIsLoading(true);
    try {
      const data = await api.getCloudCredentials();
      setCredentials(data);
    } catch (err: any) {
      console.error('Failed to load cloud credentials', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCredentials();
      setScanNotice(null);
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Multi-file upload
  const handleMultipleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    const newStaged: typeof stagedFiles = [];

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        try {
          const parsed = JSON.parse(content);
          let detectedProvider: CloudProvider = 'GCP';
          let projectId = parsed.project_id || parsed.projectId || parsed.account_id || 'cloud-proj';
          let clientEmail = parsed.client_email || parsed.access_key_id || 'service-account';

          if (parsed.type === 'service_account' || parsed.private_key_id) {
            detectedProvider = 'GCP';
          } else if (parsed.aws_access_key_id || parsed.access_key_id || parsed.RoleArn) {
            detectedProvider = 'AWS';
          } else if (parsed.tenant_id || parsed.client_id) {
            detectedProvider = 'AZURE';
          }

          newStaged.push({
            fileName: file.name,
            content,
            provider: detectedProvider,
            projectId,
            clientEmail,
          });

          // Update state when all files are processed
          if (newStaged.length === files.length) {
            setStagedFiles((prev) => [...prev, ...newStaged]);
          }
        } catch {
          setErrorMsg(`File "${file.name}" is not a valid JSON credentials file.`);
        }
      };
      reader.readAsText(file);
    });
  };

  // Add parsed raw JSON paste
  const handleAddRawJson = () => {
    if (!rawJsonPaste.trim()) return;
    try {
      const parsed = JSON.parse(rawJsonPaste);
      const isArray = Array.isArray(parsed);
      const items = isArray ? parsed : [parsed];

      const newStaged = items.map((item, idx) => {
        let detectedProvider: CloudProvider = 'GCP';
        let projectId = item.project_id || item.account_id || `cloud-key-${idx + 1}`;
        let clientEmail = item.client_email || item.access_key_id || 'service-account';

        if (item.type === 'service_account' || item.private_key_id) {
          detectedProvider = 'GCP';
        } else if (item.aws_access_key_id || item.access_key_id) {
          detectedProvider = 'AWS';
        }

        return {
          fileName: `pasted-credential-${idx + 1}.json`,
          content: JSON.stringify(item),
          provider: detectedProvider,
          projectId,
          clientEmail,
        };
      });

      setStagedFiles((prev) => [...prev, ...newStaged]);
      setRawJsonPaste('');
      setErrorMsg(null);
    } catch {
      setErrorMsg('Invalid JSON format. Please verify your pasted credentials payload.');
    }
  };

  // Submit Staged Keys
  const handleSaveStagedKeys = async () => {
    if (stagedFiles.length === 0) return;
    setIsImporting(true);
    setErrorMsg(null);

    try {
      const itemsToImport = stagedFiles.map((staged) => ({
        name: staged.fileName,
        provider: staged.provider,
        keyBlob: staged.content,
        clientId: selectedClientId || undefined,
        autoScanInterval: defaultInterval,
        isActive: true,
      }));

      await api.batchImportCloudCredentials(itemsToImport);
      setStagedFiles([]);
      await loadCredentials();
      onUpdated();
      setActiveTab('list');
      setScanNotice(`Successfully imported and securely saved ${itemsToImport.length} Service Account Key(s).`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save cloud credentials');
    } finally {
      setIsImporting(false);
    }
  };

  // Trigger Scan for Single Key
  const handleScanOne = async (cred: CloudCredential) => {
    setScanningId(cred.id);
    setErrorMsg(null);
    setScanNotice(null);

    try {
      const result = await api.scanCloudCredential(cred.id);
      await loadCredentials();
      onUpdated();

      if (result.driftEvents.length > 0) {
        setScanNotice(
          `Scan completed for "${cred.name}". Detected ${result.driftEvents.length} change(s) & updated historical drift log.`,
        );
      } else {
        setScanNotice(`Scan completed for "${cred.name}". Discovered ${result.totalDiscovered} assets with 0 drift changes.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to scan credential "${cred.name}"`);
    } finally {
      setScanningId(null);
    }
  };

  // Trigger Fleet Re-Scan All
  const handleScanAll = async () => {
    setIsScanningAll(true);
    setErrorMsg(null);
    setScanNotice(null);

    try {
      const results = await api.scanAllCloudCredentials();
      await loadCredentials();
      onUpdated();

      const totalDrifts = results.reduce((acc, r) => acc + (r.driftEvents?.length || 0), 0);
      const totalAssets = results.reduce((acc, r) => acc + (r.totalDiscovered || 0), 0);

      setScanNotice(
        `Fleet Re-scan finished across ${results.length} active Service Account(s). Verified ${totalAssets} cloud resources, recorded ${totalDrifts} drift update(s).`,
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to execute fleet re-scan');
    } finally {
      setIsScanningAll(false);
    }
  };

  // Toggle Active State
  const handleToggleActive = async (cred: CloudCredential) => {
    try {
      const updated = await api.updateCloudCredential(cred.id, {
        isActive: !cred.isActive,
      });
      setCredentials((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to toggle active status');
    }
  };

  // Change Interval
  const handleIntervalChange = async (cred: CloudCredential, newInterval: string) => {
    try {
      const updated = await api.updateCloudCredential(cred.id, {
        autoScanInterval: newInterval,
      });
      setCredentials((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update scan interval');
    }
  };

  // Delete Credential
  const handleDelete = async (cred: CloudCredential) => {
    if (!window.confirm(`Are you sure you want to remove credential "${cred.name}"?`)) return;

    try {
      await api.deleteCloudCredential(cred.id);
      setCredentials((prev) => prev.filter((c) => c.id !== cred.id));
      onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete credential');
    }
  };

  // Format relative elapsed time
  const formatTimeAgo = (isoDate?: string) => {
    if (!isoDate) return 'Never';
    const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const activeScannersCount = credentials.filter((c) => c.isActive && c.autoScanInterval !== 'OFF').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="glass-panel w-full max-w-5xl rounded-3xl p-6 border border-slate-700 shadow-2xl max-h-[92vh] flex flex-col justify-between">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <KeyRound className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Cloud Service Accounts & Automated Re-Scan Vault
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                    {credentials.length} Saved Keys
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Manage multi-cloud credential JSON blobs, configure automated re-scan intervals, and track infrastructure drift.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl transition-colors hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">
                  Saved Credentials
                </span>
                <span className="text-lg font-bold text-white font-mono">{credentials.length} Accounts</span>
              </div>
              <Shield className="w-5 h-5 text-brand-400 opacity-60" />
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">
                  Active Auto-Scanners
                </span>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  {activeScannersCount} of {credentials.length} Active
                </span>
              </div>
              <Clock className="w-5 h-5 text-emerald-400 opacity-60" />
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">
                  Fleet Scan Action
                </span>
                <button
                  type="button"
                  onClick={handleScanAll}
                  disabled={isScanningAll || credentials.length === 0}
                  className="mt-0.5 px-3 py-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md shadow-brand-600/20 flex items-center gap-1.5 transition-all"
                >
                  {isScanningAll ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Scanning Fleet...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-300" />
                      Re-scan All Accounts
                    </>
                  )}
                </button>
              </div>
              <RefreshCw className={`w-5 h-5 text-indigo-400 opacity-60 ${isScanningAll ? 'animate-spin' : ''}`} />
            </div>
          </div>

          {/* Feedback Notices */}
          {scanNotice && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {scanNotice}
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'list'
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Saved Key Blobs ({credentials.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'add'
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Import Multiple Keys {stagedFiles.length > 0 && `(${stagedFiles.length} Staged)`}
            </button>
          </div>

          {/* TAB 1: Saved Key List */}
          {activeTab === 'list' && (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
                  <span className="text-xs">Loading Cloud Keys Vault...</span>
                </div>
              ) : credentials.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl p-6 bg-slate-900/30">
                  <KeyRound className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-white">No Cloud Service Accounts Saved</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
                    Import single or multiple GCP Service Account JSON keys or AWS credentials to automate drift detection.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('add')}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Import Key Files
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {credentials.map((cred) => {
                    const isCurrentScanning = scanningId === cred.id || isScanningAll;
                    return (
                      <div
                        key={cred.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          cred.isActive
                            ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                            : 'bg-slate-950/40 border-slate-900 opacity-60'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          {/* Key Identity */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="mt-0.5">
                              <StatusBadge status={cred.provider} />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white truncate">{cred.name}</span>
                                {cred.client && (
                                  <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-300 font-semibold border border-slate-700 truncate max-w-[120px]">
                                    {cred.client.name}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                <span className="font-mono text-slate-300">
                                  Project: <strong className="text-emerald-400">{cred.metadata?.projectId || 'N/A'}</strong>
                                </span>
                                <span>•</span>
                                <span className="font-mono truncate max-w-[240px]" title={cred.metadata?.accountEmail}>
                                  {cred.metadata?.accountEmail || 'sa@iam.gserviceaccount.com'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Interval & Status Settings */}
                          <div className="flex flex-wrap items-center gap-3 shrink-0">
                            {/* Auto-scan interval */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-400">Re-scan:</span>
                              <select
                                value={cred.autoScanInterval}
                                onChange={(e) => handleIntervalChange(cred, e.target.value)}
                                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-brand-500 font-medium"
                              >
                                <option value="15m">Every 15 min</option>
                                <option value="30m">Every 30 min</option>
                                <option value="1h">Every 1 hour</option>
                                <option value="6h">Every 6 hours</option>
                                <option value="12h">Every 12 hours</option>
                                <option value="24h">Every 24 hours</option>
                                <option value="OFF">Disabled</option>
                              </select>
                            </div>

                            {/* Last Scan & Status Pill */}
                            <div className="text-right">
                              <div className="flex items-center gap-1.5 justify-end">
                                <span
                                  className={`inline-block w-2 h-2 rounded-full ${
                                    isCurrentScanning
                                      ? 'bg-indigo-400 animate-pulse'
                                      : cred.scanStatus === 'SUCCESS'
                                      ? 'bg-emerald-400'
                                      : cred.scanStatus === 'FAILED'
                                      ? 'bg-rose-400'
                                      : 'bg-slate-500'
                                  }`}
                                />
                                <span className="text-[11px] font-mono text-slate-300">
                                  {isCurrentScanning ? 'Scanning...' : formatTimeAgo(cred.lastScannedAt)}
                                </span>
                              </div>

                              {cred.lastScanSummary && cred.lastScanSummary.totalDiscovered !== undefined && (
                                <span className="text-[10px] text-slate-500 block">
                                  {cred.lastScanSummary.totalDiscovered} assets • {cred.lastScanSummary.updatedAssetsCount || 0} drift
                                </span>
                              )}
                            </div>

                            {/* Active Switch */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(cred)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                cred.isActive
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-500 border border-slate-700'
                              }`}
                            >
                              {cred.isActive ? 'Active' : 'Paused'}
                            </button>

                            {/* Scan Now Action */}
                            <button
                              type="button"
                              onClick={() => handleScanOne(cred)}
                              disabled={isCurrentScanning}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 hover:text-white rounded-lg border border-slate-700 text-xs transition-colors"
                              title="Re-scan Cloud Resources Now"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isCurrentScanning ? 'animate-spin text-brand-400' : ''}`} />
                            </button>

                            {/* Delete Key */}
                            <button
                              type="button"
                              onClick={() => handleDelete(cred)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/20 text-xs transition-colors"
                              title="Delete Key"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Batch Import Keys */}
          {activeTab === 'add' && (
            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              {/* Dropzone for Multi-file */}
              <div className="border-2 border-dashed border-slate-700 hover:border-brand-500/60 bg-slate-900/40 rounded-2xl p-6 text-center transition-all relative cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept=".json,.txt"
                  onChange={handleMultipleFiles}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400 shadow-md">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">
                      Drop one or <span className="text-emerald-400">multiple Service Account Key JSON files</span> here
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Select multiple GCP <code className="text-emerald-400 font-mono">*.json</code> keys, AWS credentials, or Azure SP files simultaneously
                    </p>
                  </div>
                </div>
              </div>

              {/* Staged Keys Stash Table */}
              {stagedFiles.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-white pb-2 border-b border-slate-800">
                    <span className="flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-emerald-400" />
                      Staged Key Files ({stagedFiles.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setStagedFiles([])}
                      className="text-[11px] text-slate-400 hover:text-rose-400"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                    {stagedFiles.map((staged, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusBadge status={staged.provider} />
                          <span className="font-mono text-xs text-white truncate max-w-[180px]">{staged.fileName}</span>
                          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                            (Proj: {staged.projectId})
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setStagedFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Paste Textarea Fallback */}
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">
                  Or paste raw JSON credentials (supports single object or JSON array <code className="text-emerald-400 font-mono">[&#123;...&#125;, &#123;...&#125;]</code>):
                </span>
                <div className="flex gap-2">
                  <textarea
                    rows={3}
                    placeholder='[{"type": "service_account", "project_id": "gcp-prod-1", ...}, {"type": "service_account", "project_id": "gcp-prod-2", ...}]'
                    value={rawJsonPaste}
                    onChange={(e) => setRawJsonPaste(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddRawJson}
                    disabled={!rawJsonPaste.trim()}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 self-end"
                  >
                    Parse JSON
                  </button>
                </div>
              </div>

              {/* Staged Keys Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Assign Staged Keys to Client (Optional):
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Internal MSP Infrastructure</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Default Auto-Scan Interval:
                  </label>
                  <select
                    value={defaultInterval}
                    onChange={(e) => setDefaultInterval(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
                  >
                    <option value="15m">Every 15 minutes</option>
                    <option value="30m">Every 30 minutes</option>
                    <option value="1h">Every 1 hour (Recommended)</option>
                    <option value="6h">Every 6 hours</option>
                    <option value="12h">Every 12 hours</option>
                    <option value="24h">Every 24 hours</option>
                    <option value="OFF">Disabled</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
          >
            Close
          </button>

          {activeTab === 'add' ? (
            <button
              type="button"
              onClick={handleSaveStagedKeys}
              disabled={isImporting || stagedFiles.length === 0}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 flex items-center gap-2 transition-all"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Storing Keys in Vault...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save {stagedFiles.length} Key(s) to Vault
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              Import More Keys
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
