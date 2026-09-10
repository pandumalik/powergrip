import React from 'react';
import { Trash2, CheckSquare, Square, X, ShieldAlert } from 'lucide-react';

export interface BulkActionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  isAllSelected: boolean;
  resourceName?: string;
  deleteLabel?: string;
  customActions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'primary' | 'warning' | 'danger';
  }>;
}

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected,
  isAllSelected,
  resourceName = 'items',
  deleteLabel,
  customActions = [],
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-20 z-30 mb-4 animate-in slide-in-from-top-2 duration-200">
      <div className="glass-panel bg-slate-900/95 border border-brand-500/40 rounded-2xl px-4 py-3 shadow-2xl shadow-brand-500/10 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Selected count & toggles */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-brand-500/15 border border-brand-500/30 text-brand-300 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <CheckSquare className="w-4 h-4 text-brand-400" />
            <span>
              {selectedCount} of {totalCount} {resourceName} selected
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={isAllSelected ? onDeselectAll : onSelectAll}
              className="px-2.5 py-1 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700"
            >
              {isAllSelected ? 'Deselect All' : `Select All (${totalCount})`}
            </button>
            <button
              type="button"
              onClick={onDeselectAll}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {customActions.map((action, idx) => (
            <button
              key={idx}
              type="button"
              onClick={action.onClick}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-sm"
            >
              {action.icon}
              {action.label}
            </button>
          ))}

          <button
            type="button"
            onClick={onDeleteSelected}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 border border-rose-500"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleteLabel || `Delete Selected (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
};
