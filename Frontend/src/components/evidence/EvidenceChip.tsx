import React from 'react';
import type { CanonicalEvidenceItem, CanonicalEvidenceType } from '../../types/api';
import {
  Scan,
  FileText,
  BookOpen,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface EvidenceChipProps {
  item: CanonicalEvidenceItem;
  onClick?: (item: CanonicalEvidenceItem) => void;
  showConfidence?: boolean;
  size?: 'sm' | 'md';
}

export const getEvidenceTypeStyles = (type: CanonicalEvidenceType) => {
  switch (type) {
    case 'MODEL_FINDING':
      return {
        bg: 'bg-[#F2E4D5]/70 hover:bg-cyan-900/80',
        border: 'border-[#D9C6B7]/60',
        text: 'text-[#8B6F5B]',
        icon: Scan,
        label: 'Model Finding',
        badgeBg: 'bg-cyan-500/20 text-cyan-200 border-[#8B6F5B]/30',
      };
    case 'PATIENT_RECORD':
      return {
        bg: 'bg-rose-950/70 hover:bg-rose-900/80',
        border: 'border-rose-700/60',
        text: 'text-rose-300',
        icon: FileText,
        label: 'Patient Record',
        badgeBg: 'bg-rose-500/20 text-rose-200 border-rose-500/30',
      };
    case 'TRUSTED_KNOWLEDGE':
      return {
        bg: 'bg-purple-950/70 hover:bg-purple-900/80',
        border: 'border-purple-700/60',
        text: 'text-purple-300',
        icon: BookOpen,
        label: 'Trusted Knowledge',
        badgeBg: 'bg-purple-500/20 text-purple-200 border-purple-500/30',
      };
    case 'GENERATED_SYNTHESIS':
      return {
        bg: 'bg-amber-950/70 hover:bg-amber-900/80',
        border: 'border-amber-700/60',
        text: 'text-amber-300',
        icon: Sparkles,
        label: 'Generated Synthesis',
        badgeBg: 'bg-amber-500/20 text-amber-200 border-amber-500/30',
      };
  }
};

export const EvidenceChip: React.FC<EvidenceChipProps> = ({
  item,
  onClick,
  showConfidence = true,
  size = 'md',
}) => {
  const styles = getEvidenceTypeStyles(item.evidence_type);
  const Icon = styles.icon;

  const isSmall = size === 'sm';

  return (
    <button
      type="button"
      onClick={() => onClick && onClick(item)}
      className={`inline-flex items-center gap-1.5 rounded-lg border transition-all cursor-pointer text-left ${
        styles.bg
      } ${styles.border} ${
        isSmall ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } hover:shadow-md hover:scale-[1.01]`}
      title={`Click to view provenance for: ${item.title}`}
    >
      <Icon className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${styles.text} shrink-0`} />

      <span className="font-semibold truncate max-w-[170px] text-[#3B2A1C]">
        {item.title}
      </span>

      {showConfidence && item.confidence !== undefined && item.confidence !== null && (
        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white text-[#8B6F5B] border border-[#D9C6B7]">
          {(item.confidence * 100).toFixed(0)}%
        </span>
      )}

      {item.evidence_type === 'GENERATED_SYNTHESIS' && (
        <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
          SYNTHESIS
        </span>
      )}

      {item.provenance?.trace_path && item.provenance.trace_path.length > 0 && (
        <ArrowRight className="w-2.5 h-2.5 text-[#6E5D4F] shrink-0" />
      )}
    </button>
  );
};
