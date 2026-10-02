import React from 'react';
import type { ModelStatusState } from '../../types/api';
import { Badge } from '../ui/badge';
import { CheckCircle2, AlertTriangle, AlertCircle, XCircle, Cpu, Zap } from 'lucide-react';

interface ModelStatusBadgeProps {
  status: ModelStatusState;
  device?: string;
  className?: string;
  showDevice?: boolean;
}

export const ModelStatusBadge: React.FC<ModelStatusBadgeProps> = ({
  status,
  device = 'cpu',
  className = '',
  showDevice = true,
}) => {
  switch (status) {
    case 'READY':
      return (
        <div className={`inline-flex items-center gap-1.5 ${className}`}>
          <Badge
            variant="outline"
            className="bg-emerald-950/60 border-emerald-500/40 text-emerald-300 font-medium px-2.5 py-1 text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-950/50"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>MODEL READY</span>
          </Badge>
          {showDevice && (
            <Badge
              variant="outline"
              className="bg-white border-[#D9C6B7] text-[#5A4D3B] text-xs px-2 py-0.5 flex items-center gap-1"
            >
              {device === 'cuda' ? (
                <>
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>CUDA GPU</span>
                </>
              ) : (
                <>
                  <Cpu className="w-3 h-3 text-[#8B6F5B]" />
                  <span>CPU INFERENCE</span>
                </>
              )}
            </Badge>
          )}
        </div>
      );

    case 'NOT_CONFIGURED':
      return (
        <Badge
          variant="outline"
          className={`bg-amber-950/60 border-amber-500/40 text-amber-300 font-medium px-2.5 py-1 text-xs flex items-center gap-1.5 ${className}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>NOT CONFIGURED</span>
        </Badge>
      );

    case 'MODEL_UNAVAILABLE':
      return (
        <Badge
          variant="outline"
          className={`bg-violet-950/60 border-violet-500/40 text-violet-300 font-medium px-2.5 py-1 text-xs flex items-center gap-1.5 ${className}`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-violet-400" />
          <span>MODEL UNAVAILABLE</span>
        </Badge>
      );

    case 'ERROR':
    default:
      return (
        <Badge
          variant="outline"
          className={`bg-rose-950/60 border-rose-500/40 text-rose-300 font-medium px-2.5 py-1 text-xs flex items-center gap-1.5 ${className}`}
        >
          <XCircle className="w-3.5 h-3.5 text-rose-400" />
          <span>MODEL ERROR</span>
        </Badge>
      );
  }
};
