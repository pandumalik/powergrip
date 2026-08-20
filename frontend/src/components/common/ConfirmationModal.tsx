import React from 'react';
import { AlertTriangle, ShieldAlert, Trash2, X, Loader2, Info } from 'lucide-react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  itemName?: string;
  itemTag?: string;
  itemDetails?: Array<{ label: string; value: string }>;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  itemTag,
  itemDetails,
  confirmLabel = 'Delete Item',
  cancelLabel = 'Cancel',
  isDestructive = true,
  isLoading = false,
  errorMessage = null,
  variant = 'danger',
}) => {
  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isLoading) {
      onClose();
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-400" />,
          iconBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/10',
          btnBg: 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-semibold shadow-amber-500/20',
          ring: 'focus:ring-amber-500/30',
        };
      case 'info':
        return {
          icon: <Info className="w-6 h-6 text-blue-400" />,
          iconBg: 'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-blue-500/10',
          btnBg: 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium shadow-blue-500/20',
          ring: 'focus:ring-blue-500/30',
        };
      case 'danger':
      default:
        return {
          icon: <ShieldAlert className="w-6 h-6 text-rose-400" />,
          iconBg: 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-rose-500/10',
          btnBg: 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-medium shadow-rose-500/20',
          ring: 'focus:ring-rose-500/30',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
    >
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-slate-700/80 bg-slate-900/95 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-800/80">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl border shadow-lg ${styles.iconBg} shrink-0`}>
              {styles.icon}
            </div>
            <div className="pt-0.5">
              <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Target Item Pill */}
          {(itemName || itemTag) && (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                {itemName && (
                  <p className="text-xs font-semibold text-white truncate font-mono">{itemName}</p>
                )}
                {itemTag && (
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">{itemTag}</p>
                )}
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 shrink-0">
                Target Action
              </span>
            </div>
          )}

          {/* Additional details */}
          {itemDetails && itemDetails.length > 0 && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {itemDetails.map((detail, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
                    {detail.label}
                  </span>
                  <span className="text-slate-200 font-mono text-[11px] truncate block mt-0.5">
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Dynamic Error / Conflict Alert Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-600/50 shadow-lg shadow-rose-950/30 text-rose-200 text-xs leading-relaxed animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-rose-300 block">Operation Restricted</span>
                  <p className="text-[11px] text-rose-200/90">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm()}
            disabled={isLoading}
            className={`px-4 py-2 text-xs rounded-xl border border-transparent flex items-center gap-2 shadow-lg transition-all disabled:opacity-50 ${styles.btnBg} ${styles.ring}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {isDestructive && <Trash2 className="w-3.5 h-3.5" />}
                {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
