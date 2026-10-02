import React from 'react';
import { Badge } from '../ui/badge';
import { CheckCircle2, AlertTriangle, AlertCircle, XCircle, Archive } from 'lucide-react';

interface ModelStatusPillProps {
  status: string;
  runtimeStatus?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const ModelStatusPill: React.FC<ModelStatusPillProps> = ({
  status,
  runtimeStatus,
  className = '',
  size = 'md',
}) => {
  const effectiveStatus = (runtimeStatus || status || '').toLowerCase();
  const textClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  const iconClass = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  switch (effectiveStatus) {
    case 'ready':
    case 'active':
      return (
        <Badge
          variant="outline"
          className={`bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold flex items-center gap-1.5 shadow-sm ${textClass} ${className}`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
          </span>
          <CheckCircle2 className={`${iconClass} text-emerald-700`} />
          <span className="uppercase">READY</span>
        </Badge>
      );

    case 'not_configured':
      return (
        <Badge
          variant="outline"
          className={`bg-amber-50 border-amber-300 text-amber-900 font-medium flex items-center gap-1.5 ${textClass} ${className}`}
        >
          <AlertTriangle className={`${iconClass} text-amber-700`} />
          <span className="uppercase">NOT CONFIGURED</span>
        </Badge>
      );

    case 'model_unavailable':
      return (
        <Badge
          variant="outline"
          className={`bg-purple-50 border-purple-300 text-purple-900 font-medium flex items-center gap-1.5 ${textClass} ${className}`}
        >
          <AlertCircle className={`${iconClass} text-purple-700`} />
          <span className="uppercase">UNAVAILABLE</span>
        </Badge>
      );

    case 'deprecated':
      return (
        <Badge
          variant="outline"
          className={`bg-[#FAF6F0] border-[#D9C6B7] text-[#6E5D4F] font-medium flex items-center gap-1.5 ${textClass} ${className}`}
        >
          <Archive className={`${iconClass} text-[#6E5D4F]`} />
          <span className="uppercase">DEPRECATED</span>
        </Badge>
      );

    case 'error':
    default:
      return (
        <Badge
          variant="outline"
          className={`bg-rose-50 border-rose-300 text-rose-800 font-medium flex items-center gap-1.5 ${textClass} ${className}`}
        >
          <XCircle className={`${iconClass} text-rose-700`} />
          <span className="uppercase">ERROR</span>
        </Badge>
      );
  }
};

