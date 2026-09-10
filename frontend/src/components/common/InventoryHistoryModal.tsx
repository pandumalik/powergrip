import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { InventoryItem, InventoryHistory } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  History,
  X,
  Clock,
  ArrowRight,
  ShieldAlert,
  Server,
  Code2,
  ChevronDown,
  ChevronUp,
  Cpu,
  RefreshCw,
  Tag,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react';

interface InventoryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItem: InventoryItem | null;
}

export const InventoryHistoryModal: React.FC<InventoryHistoryModalProps> = ({
  isOpen,
  onClose,
  inventoryItem,
}) => {
  const [historyLogs, setHistoryLogs] = useState<InventoryHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');

  useEffect(() => {
    if (isOpen && inventoryItem) {
      setIsLoading(true);
      api
        .getInventoryHistory(inventoryItem.id)
        .then((data) => {
          setHistoryLogs(data);
          if (data.length > 0) {
            setExpandedLogId(data[0].id);
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setHistoryLogs([]);
      setExpandedLogId(null);
    }
  }, [isOpen, inventoryItem]);

  if (!isOpen || !inventoryItem) return null;

  const filteredLogs = historyLogs.filter(
    (log) => filterType === 'ALL' || log.changeType === filterType || log.source === filterType,
  );

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'SPECS_CHANGED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'STATUS_CHANGED':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'IP_CHANGED':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'CREATED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'TERMINATED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const formatDateTime = (isoDate: string) => {
    const d = new Date(isoDate);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="glass-panel w-full max-w-4xl rounded-3xl p-6 border border-slate-700 shadow-2xl max-h-[90vh] flex flex-col justify-between">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 via-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
                <History className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Historical Change Timeline & Drift Audit
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {historyLogs.length} Events Logged
                  </span>
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span className="font-bold text-white">{inventoryItem.name}</span>
                  <span>•</span>
                  <span className="font-mono text-emerald-400">{inventoryItem.assetTag}</span>
                  <span>•</span>
                  <span>{inventoryItem.provider} ({inventoryItem.region})</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl transition-colors hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800/80 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px] font-semibold">Filter:</span>
              {['ALL', 'SPECS_CHANGED', 'STATUS_CHANGED', 'IP_CHANGED', 'CREATED'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(type)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterType === type
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {type === 'ALL' ? 'All Events' : type.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-slate-500 font-mono">
              Showing {filteredLogs.length} of {historyLogs.length} entries
            </span>
          </div>

          {/* Timeline Feed */}
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
                <span className="text-xs">Loading historical change records...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl p-6 bg-slate-900/30">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-white">No historical change records found</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Changes detected during automated periodic cloud re-scans or administrative edits will appear here.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const hasDiff = log.previousState && Object.keys(log.previousState).length > 0;

                  return (
                    <div key={log.id} className="relative group">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[27px] top-3.5 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-brand-500 group-hover:scale-110 transition-transform shadow" />

                      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all">
                        {/* Summary Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md border ${getChangeTypeColor(
                                log.changeType,
                              )}`}
                            >
                              {log.changeType.replace(/_/g, ' ')}
                            </span>

                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              Source: {log.source}
                            </span>
                          </div>

                          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {formatDateTime(log.createdAt)}
                          </span>
                        </div>

                        {/* Change Description */}
                        <p className="text-xs font-semibold text-white mt-2 mb-1.5 leading-relaxed">
                          {log.changeSummary}
                        </p>

                        {/* Service Account Tag */}
                        {log.serviceAccount && (
                          <div className="text-[11px] text-slate-400 font-mono mb-2">
                            Detected via Service Account:{' '}
                            <span className="text-emerald-400 font-bold">{log.serviceAccount.name}</span>
                          </div>
                        )}

                        {/* Diff Box Accordion */}
                        {hasDiff && (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5" /> Hide State Snapshot Diff
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3.5 h-3.5" /> View State Snapshot Diff
                                </>
                              )}
                            </button>

                            {isExpanded && (
                              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs animate-in fade-in duration-200">
                                {/* Previous State (Old) */}
                                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-300">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-1">
                                    Previous State (Before Change)
                                  </span>
                                  <pre className="text-[11px] font-mono whitespace-pre-wrap break-all bg-black/40 p-2 rounded-lg text-rose-200">
                                    {JSON.stringify(log.previousState, null, 2)}
                                  </pre>
                                </div>

                                {/* New State (Current) */}
                                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-300">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                                    New State (After Change)
                                  </span>
                                  <pre className="text-[11px] font-mono whitespace-pre-wrap break-all bg-black/40 p-2 rounded-lg text-emerald-200">
                                    {JSON.stringify(log.newState, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-slate-800 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};
