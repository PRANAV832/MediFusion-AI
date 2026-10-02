import { ShieldAlert, AlertTriangle, CheckCircle2, Clock, FileText, Database, Sparkles, Cpu, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from './badge';

// --- REVIEW STATE BADGE ---
export type ClinicalReviewState =
  | 'CLEAR'
  | 'REVIEW_REQUIRED'
  | 'MODEL_DISAGREEMENT'
  | 'INSUFFICIENT_EVIDENCE'
  | 'INPUT_QUALITY_ISSUE'
  | string;

export function ReviewStateBadge({ state, className }: { state?: ClinicalReviewState; className?: string }) {
  const norm = (state || 'REVIEW_REQUIRED').toUpperCase();
  switch (norm) {
    case 'CLEAR':
      return (
        <Badge variant="success" className={cn('gap-1.5 py-1 px-2.5', className)}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          <span>CLEAR FOR CLINICIAN REVIEW</span>
        </Badge>
      );
    case 'MODEL_DISAGREEMENT':
      return (
        <Badge variant="destructive" className={cn('gap-1.5 py-1 px-2.5', className)}>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
          <span>MODEL DISAGREEMENT DETECTED</span>
        </Badge>
      );
    case 'INSUFFICIENT_EVIDENCE':
      return (
        <Badge variant="warning" className={cn('gap-1.5 py-1 px-2.5', className)}>
          <HelpCircle className="w-3.5 h-3.5 text-amber-800" />
          <span>INSUFFICIENT EVIDENCE</span>
        </Badge>
      );
    case 'INPUT_QUALITY_ISSUE':
      return (
        <Badge variant="warning" className={cn('gap-1.5 py-1 px-2.5', className)}>
          <AlertTriangle className="w-3.5 h-3.5 text-amber-800" />
          <span>INPUT QUALITY DEGRADED</span>
        </Badge>
      );
    case 'REVIEW_REQUIRED':
    default:
      return (
        <Badge variant="warning" className={cn('gap-1.5 py-1 px-2.5', className)}>
          <Clock className="w-3.5 h-3.5 text-amber-800" />
          <span>REVIEW REQUIRED</span>
        </Badge>
      );
  }
}

// --- EVIDENCE TYPE BADGE ---
export type EvidenceType =
  | 'MODEL_FINDING'
  | 'PATIENT_RECORD'
  | 'TRUSTED_KNOWLEDGE'
  | 'GENERATED_SYNTHESIS'
  | string;

export function EvidenceTypeBadge({ type, className }: { type: EvidenceType; className?: string }) {
  const norm = type.toUpperCase().replace(/\s+/g, '_');
  switch (norm) {
    case 'MODEL_FINDING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-indigo-50 text-indigo-900 border border-indigo-200',
            className
          )}
        >
          <Cpu className="w-3 h-3 text-indigo-700" />
          MODEL FINDING
        </span>
      );
    case 'PATIENT_RECORD':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-900 border border-emerald-200',
            className
          )}
        >
          <FileText className="w-3 h-3 text-emerald-700" />
          PATIENT RECORD
        </span>
      );
    case 'TRUSTED_KNOWLEDGE':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-purple-50 text-purple-900 border border-purple-200',
            className
          )}
        >
          <Database className="w-3 h-3 text-purple-700" />
          TRUSTED KNOWLEDGE
        </span>
      );
    case 'GENERATED_SYNTHESIS':
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7]',
            className
          )}
        >
          <Sparkles className="w-3 h-3 text-[#8B6F5B]" />
          GENERATED SYNTHESIS
        </span>
      );
  }
}

// --- CASE PRIORITY BADGE ---
export function PriorityBadge({ priority, className }: { priority?: string; className?: string }) {
  const norm = (priority || 'ROUTINE').toUpperCase();
  switch (norm) {
    case 'STAT':
      return (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-[10px] tracking-widest bg-rose-100 text-rose-900 border border-rose-300 animate-pulse', className)}>
          STAT
        </span>
      );
    case 'URGENT':
      return (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-[10px] tracking-wider bg-amber-100 text-amber-900 border border-amber-300', className)}>
          URGENT
        </span>
      );
    case 'ROUTINE':
    default:
      return (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded font-mono font-medium text-[10px] tracking-wider bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7]', className)}>
          ROUTINE
        </span>
      );
  }
}

// --- UNCERTAINTY BADGE ---
export function UncertaintyBadge({
  uncertainty,
  confidence,
  className,
}: {
  uncertainty?: number | string;
  confidence?: number;
  className?: string;
}) {
  const val = typeof uncertainty === 'number' ? uncertainty : (1 - (confidence ?? 0.8));
  let color = 'bg-emerald-50 text-emerald-900 border-emerald-200';
  let label = 'LOW UNCERTAINTY';

  if (val >= 0.5) {
    color = 'bg-rose-50 text-rose-900 border-rose-200';
    label = 'HIGH UNCERTAINTY';
  } else if (val >= 0.25) {
    color = 'bg-amber-50 text-amber-900 border-amber-200';
    label = 'MODERATE UNCERTAINTY';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border font-medium',
        color,
        className
      )}
      title={`Uncertainty Score: ${(val * 100).toFixed(1)}%`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      <span>{label} (±{(val * 100).toFixed(0)}%)</span>
    </span>
  );
}

// --- MEDICAL SAFETY WARNING BANNER / BADGE ---
export function MedicalSafetyBanner({ className }: { className?: string }) {
  return (
    <div
      role="note"
      aria-label="Clinical safety warning"
      className={cn(
        'flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#FCF8F2] border border-[#D9C6B7] text-[#5A4D3B] text-xs font-medium shadow-2xs',
        className
      )}
    >
      <div className="p-1.5 rounded-lg bg-[#F2E4D5] text-[#8B6F5B] shrink-0 border border-[#D9C6B7]/60">
        <ShieldAlert className="w-4 h-4 stroke-[2]" />
      </div>
      <div className="flex-1 leading-normal">
        <span className="font-bold text-[#3B2A1C] tracking-wide">INVESTIGATIONAL CLINICAL WORKSTATION:</span>{' '}
        This system is a non-autonomous clinical decision support tool. It does not issue diagnostic determinations. All syntheses, scores, and findings require credentialed clinician review and provenance verification prior to clinical action.
      </div>
    </div>
  );
}
