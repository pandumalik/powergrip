import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'status' | 'scope' | 'provider' | 'level';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'status' }) => {
  let colorClasses = 'bg-slate-800/80 text-slate-300 border-slate-700';

  if (['ACTIVE', 'APPROVED', 'IN_PROGRESS', 'PROD'].includes(status)) {
    colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  } else if (['PENDING', 'ENDORSED', 'PLANNING', 'STAGING', 'MAINTENANCE'].includes(status)) {
    colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  } else if (['REJECTED', 'REVOKED', 'EXPIRED', 'TERMINATED', 'CANCELLED', 'ISOLATED'].includes(status)) {
    colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  } else if (['ROOT_SUPERADMIN', 'ADMIN'].includes(status)) {
    colorClasses = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
  } else if (['CLIENT', 'GCP', 'AWS', 'ALI_CLOUD'].includes(status)) {
    colorClasses = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  } else if (['INTERNAL', 'ON_PREMISE'].includes(status)) {
    colorClasses = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses} tracking-wide`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {status.replace(/_/g, ' ')}
    </span>
  );
};
