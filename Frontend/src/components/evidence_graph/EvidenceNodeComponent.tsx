import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { CanonicalEvidenceType } from '../../types/api';
import {
  Brain,
  FileText,
  BookOpen,
  Sparkles,
  Activity,
  Layers,
  ShieldCheck,
  Tag,
} from 'lucide-react';

export type EvidenceGraphNodeType =
  | 'FINDING'
  | 'MODEL_FINDING'
  | 'PATIENT_RECORD'
  | 'TRUSTED_KNOWLEDGE'
  | 'GENERATED_SYNTHESIS'
  | 'MODEL_RUN'
  | 'SOURCE_ASSET'
  | 'DOCUMENT'
  | 'PAGE'
  | 'CHUNK'
  | 'CONFLICT';

export interface EvidenceNodeData {
  [key: string]: unknown;
  id: string;
  nodeType: EvidenceGraphNodeType;
  label: string;
  sublabel?: string;
  evidenceType?: CanonicalEvidenceType;
  confidence?: number | null;
  severity?: string;
  status?: string;
  excerpt?: string;
  tracePath?: string[];
  rawItem?: any;
  onSelectNode?: (nodeData: EvidenceNodeData) => void;
}

const TYPE_CONFIG: Record<
  EvidenceGraphNodeType,
  {
    icon: React.ElementType;
    border: string;
    bg: string;
    badgeBg: string;
    badgeText: string;
    textColor: string;
  }
> = {
  FINDING: {
    icon: Activity,
    border: 'border-[#D9C6B7] shadow-sm',
    bg: 'bg-white',
    badgeBg: 'bg-[#F2E4D5] border border-[#D9C6B7]',
    badgeText: 'text-[#5A4D3B]',
    textColor: 'text-[#3B2A1C]',
  },
  MODEL_FINDING: {
    icon: Brain,
    border: 'border-sky-300 shadow-sm',
    bg: 'bg-white',
    badgeBg: 'bg-sky-50 border border-sky-200',
    badgeText: 'text-sky-800',
    textColor: 'text-[#3B2A1C]',
  },
  PATIENT_RECORD: {
    icon: FileText,
    border: 'border-emerald-300 shadow-sm',
    bg: 'bg-white',
    badgeBg: 'bg-emerald-50 border border-emerald-200',
    badgeText: 'text-emerald-800',
    textColor: 'text-[#3B2A1C]',
  },
  TRUSTED_KNOWLEDGE: {
    icon: BookOpen,
    border: 'border-purple-300 shadow-sm',
    bg: 'bg-white',
    badgeBg: 'bg-purple-50 border border-purple-200',
    badgeText: 'text-purple-800',
    textColor: 'text-[#3B2A1C]',
  },
  GENERATED_SYNTHESIS: {
    icon: Sparkles,
    border: 'border-amber-300 shadow-sm',
    bg: 'bg-white',
    badgeBg: 'bg-amber-50 border border-amber-200',
    badgeText: 'text-amber-900',
    textColor: 'text-[#3B2A1C]',
  },
  MODEL_RUN: {
    icon: Brain,
    border: 'border-[#D9C6B7]',
    bg: 'bg-[#FCF9F5]',
    badgeBg: 'bg-[#F2E4D5] border border-[#D9C6B7]',
    badgeText: 'text-[#5A4D3B]',
    textColor: 'text-[#3B2A1C]',
  },
  SOURCE_ASSET: {
    icon: Layers,
    border: 'border-[#D9C6B7]',
    bg: 'bg-[#FCF9F5]',
    badgeBg: 'bg-[#F2E4D5] border border-[#D9C6B7]',
    badgeText: 'text-[#5A4D3B]',
    textColor: 'text-[#3B2A1C]',
  },
  DOCUMENT: {
    icon: FileText,
    border: 'border-[#D9C6B7]',
    bg: 'bg-[#FCF9F5]',
    badgeBg: 'bg-[#F2E4D5] border border-[#D9C6B7]',
    badgeText: 'text-[#5A4D3B]',
    textColor: 'text-[#3B2A1C]',
  },
  PAGE: {
    icon: FileText,
    border: 'border-[#D9C6B7]',
    bg: 'bg-[#FAF6F0]',
    badgeBg: 'bg-[#F2E4D5] border border-[#D9C6B7]',
    badgeText: 'text-[#6E5D4F]',
    textColor: 'text-[#3B2A1C]',
  },
  CHUNK: {
    icon: Tag,
    border: 'border-[#D9C6B7]',
    bg: 'bg-[#FAF6F0]',
    badgeBg: 'bg-[#F2E4D5] border border-[#D9C6B7]',
    badgeText: 'text-[#6E5D4F]',
    textColor: 'text-[#3B2A1C]',
  },
  CONFLICT: {
    icon: ShieldCheck,
    border: 'border-rose-400 shadow-sm',
    bg: 'bg-rose-50/50',
    badgeBg: 'bg-rose-100 border border-rose-300',
    badgeText: 'text-rose-800',
    textColor: 'text-rose-950',
  },
};

export const EvidenceNodeComponent: React.FC<{ data: EvidenceNodeData }> = memo(({ data }) => {
  const cfg = TYPE_CONFIG[data.nodeType] || TYPE_CONFIG.MODEL_FINDING;
  const Icon = cfg.icon;

  return (
    <div
      onClick={() => data.onSelectNode?.(data)}
      className={`relative w-64 rounded-xl border p-3.5 transition-all duration-200 cursor-pointer hover:shadow-md ${cfg.border} ${cfg.bg}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-2.5 h-2.5 !bg-[#8B6F5B] !border-2 !border-white"
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className={`p-1 rounded-md bg-[#FAF6F0] border border-[#D9C6B7] ${cfg.badgeText}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className={`text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded ${cfg.badgeBg} ${cfg.badgeText}`}>
            {data.nodeType}
          </span>
        </div>

        {data.confidence !== undefined && data.confidence !== null && (
          <span className="font-mono text-[11px] font-bold text-[#5A4D3B] bg-[#F2E4D5] px-1.5 py-0.5 rounded border border-[#D9C6B7]">
            {(data.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Main Label */}
      <h4 className={`text-xs font-bold ${cfg.textColor} line-clamp-1`}>{data.label}</h4>

      {data.sublabel && (
        <span className="text-[11px] text-[#6E5D4F] font-mono block mt-0.5 truncate">
          {data.sublabel}
        </span>
      )}

      {/* Excerpt / Summary Snippet on Hover */}
      {data.excerpt && (
        <p className="mt-2 text-[10px] text-[#5A4D3B] leading-snug line-clamp-2 bg-[#FAF6F0] p-1.5 rounded border border-[#D9C6B7]">
          "{data.excerpt}"
        </p>
      )}

      {/* Provenance trace breadcrumb preview */}
      {data.tracePath && data.tracePath.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#D9C6B7] flex items-center gap-1 text-[9px] font-mono text-[#6E5D4F] truncate">
          <span className="truncate">{data.tracePath.join(' → ')}</span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2.5 h-2.5 !bg-[#8B6F5B] !border-2 !border-white"
      />
    </div>
  );
});

EvidenceNodeComponent.displayName = 'EvidenceNodeComponent';

