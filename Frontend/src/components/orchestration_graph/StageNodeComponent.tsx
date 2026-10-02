import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { GraphStageNode, OrchestrationState } from '../../types/api';
import {
  FileText,
  Layers,
  GitBranch,
  Cpu,
  Brain,
  Activity,
  GitMerge,
  AlertTriangle,
  Sparkles,
  FileCheck2,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  ShieldAlert,
} from 'lucide-react';

interface StageNodeData {
  stage: GraphStageNode;
  label: string;
  sublabel?: string;
  state: OrchestrationState;
  duration_ms?: number | null;
  summary?: string | null;
  details?: Record<string, any>;
  onSelectNode?: (nodeId: string) => void;
}

const STAGE_ICONS: Record<GraphStageNode, React.ElementType> = {
  CASE: FileText,
  INPUTS: Layers,
  CAPABILITY_SELECTION: GitBranch,
  RESOURCE_CHECK: Cpu,
  SPECIALIZED_MODEL: Brain,
  MODEL_FINDING: Activity,
  EVIDENCE: GitMerge,
  CONFLICT_UNCERTAINTY: AlertTriangle,
  GEMINI: Sparkles,
  REPORT: FileCheck2,
};

const STATE_CONFIG: Record<
  OrchestrationState,
  {
    border: string;
    bg: string;
    badgeBg: string;
    text: string;
    icon: React.ElementType;
    pulse: boolean;
    label: string;
  }
> = {
  QUEUED: {
    border: 'border-[#D9C6B7]',
    bg: 'bg-white',
    badgeBg: 'bg-[#FAF6F0] text-[#6E5D4F] border-[#D9C6B7]',
    text: 'text-[#6E5D4F]',
    icon: Clock,
    pulse: false,
    label: 'QUEUED',
  },
  RUNNING: {
    border: 'border-[#8B6F5B] ring-2 ring-[#8B6F5B]/30 shadow-md',
    bg: 'bg-[#FCF9F5]',
    badgeBg: 'bg-[#F2E4D5] text-[#3B2A1C] border-[#8B6F5B]',
    text: 'text-[#8B6F5B]',
    icon: Loader2,
    pulse: true,
    label: 'RUNNING',
  },
  COMPLETED: {
    border: 'border-emerald-600/70 shadow-sm',
    bg: 'bg-white',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    text: 'text-emerald-700',
    icon: CheckCircle2,
    pulse: false,
    label: 'COMPLETED',
  },
  FAILED: {
    border: 'border-rose-500 shadow-sm ring-1 ring-rose-300',
    bg: 'bg-rose-50/40',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
    text: 'text-rose-700',
    icon: XCircle,
    pulse: false,
    label: 'FAILED',
  },
  REVIEW_REQUIRED: {
    border: 'border-amber-500 shadow-sm ring-2 ring-amber-400/40',
    bg: 'bg-amber-50/50',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-400',
    text: 'text-amber-800',
    icon: ShieldAlert,
    pulse: true,
    label: 'REVIEW REQUIRED',
  },
};

export const StageNodeComponent: React.FC<{ data: StageNodeData; id: string }> = memo(({ data, id }) => {
  const stage = data.stage;
  const state = data.state || 'QUEUED';
  const config = STATE_CONFIG[state] || STATE_CONFIG.QUEUED;
  const StageIcon = STAGE_ICONS[stage] || Activity;
  const StateIcon = config.icon;

  return (
    <div
      onClick={() => data.onSelectNode?.(id)}
      className={`relative w-72 rounded-xl border p-4 transition-all duration-300 cursor-pointer hover:scale-[1.02] shadow-sm ${config.border} ${config.bg}`}
    >
      {/* Target handle on top */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-[#8B6F5B] !border-2 !border-white"
      />

      {/* Header with Icon, Labels and State Badge */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] ${config.text}`}>
            <StageIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#3B2A1C] leading-tight">{data.label}</h4>
            {data.sublabel && (
              <span className="text-[11px] text-[#6E5D4F] font-mono block mt-0.5">{data.sublabel}</span>
            )}
          </div>
        </div>

        {/* State Badge */}
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${config.badgeBg}`}
        >
          <StateIcon className={`w-3 h-3 ${config.pulse ? 'animate-spin' : ''}`} />
          {config.label}
        </span>
      </div>

      {/* Summary message from real backend event */}
      {data.summary && (
        <p className="text-xs text-[#5A4D3B] leading-snug line-clamp-2 mt-2 bg-[#FAF6F0] p-2 rounded border border-[#D9C6B7]/60">
          {data.summary}
        </p>
      )}

      {/* Footer: Duration and Real Milestone Metric */}
      <div className="flex items-center justify-between text-[11px] text-[#6E5D4F] pt-2.5 mt-2.5 border-t border-[#D9C6B7]/60 font-mono">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-[#8B6F5B]" />
          {data.duration_ms ? `${data.duration_ms} ms` : '—'}
        </span>
        <span className="text-[10px] text-[#8B6F5B] font-semibold tracking-wide uppercase">
          STAGE: {stage}
        </span>
      </div>

      {/* Source handle on bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-[#8B6F5B] !border-2 !border-white"
      />
    </div>
  );
});

StageNodeComponent.displayName = 'StageNodeComponent';
