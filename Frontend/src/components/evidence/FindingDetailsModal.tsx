import React from 'react';
import type { CanonicalFinding, CanonicalEvidenceItem, FindingSeverity, FindingStatus } from '../../types/api';
import { EvidenceChip } from './EvidenceChip';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  Layers,
  ExternalLink,
  ShieldCheck,
  Stethoscope,
  Scan,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface FindingDetailsModalProps {
  finding: CanonicalFinding | null;
  allEvidenceItems: CanonicalEvidenceItem[];
  onClose: () => void;
  onSelectEvidenceItem: (item: CanonicalEvidenceItem) => void;
  onNavigateToSource?: (sourceType: string, sourceId?: string) => void;
}

export const getSeverityBadge = (severity: FindingSeverity) => {
  switch (severity) {
    case 'CRITICAL':
      return <Badge className="bg-rose-950 text-rose-300 border border-rose-600 font-bold">CRITICAL</Badge>;
    case 'HIGH':
      return <Badge className="bg-orange-950 text-orange-300 border border-orange-600 font-semibold">HIGH SEVERITY</Badge>;
    case 'MODERATE':
      return <Badge className="bg-amber-950 text-amber-300 border border-amber-600">MODERATE</Badge>;
    case 'LOW':
      return <Badge className="bg-blue-950 text-blue-300 border border-blue-600">LOW</Badge>;
    case 'NORMAL':
      return <Badge className="bg-emerald-950 text-emerald-300 border border-emerald-600">NORMAL</Badge>;
  }
};

export const getStatusBadge = (status: FindingStatus) => {
  switch (status) {
    case 'DETECTED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <AlertTriangle className="w-3 h-3" />
          Detected
        </span>
      );
    case 'RULED_OUT':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" />
          Ruled Out
        </span>
      );
    case 'EQUIVOCAL':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <HelpCircle className="w-3 h-3" />
          Equivocal / Indeterminate
        </span>
      );
    case 'PENDING_REVIEW':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FAF6F0] text-[#5A4D3B] border border-[#D9C6B7]">
          <Clock className="w-3 h-3" />
          Pending Review
        </span>
      );
  }
};

export const FindingDetailsModal: React.FC<FindingDetailsModalProps> = ({
  finding,
  allEvidenceItems,
  onClose,
  onSelectEvidenceItem,
  onNavigateToSource,
}) => {
  if (!finding) return null;

  const evidenceMap = new Map(allEvidenceItems.map((e) => [e.id, e]));
  const primaryEvidence = finding.primary_evidence_id ? evidenceMap.get(finding.primary_evidence_id) : null;
  const supportingItems = finding.supporting_evidence_ids
    .map((id) => evidenceMap.get(id))
    .filter((e): e is CanonicalEvidenceItem => Boolean(e));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white border border-[#D9C6B7] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#D9C6B7] bg-white flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {getStatusBadge(finding.status)}
              {getSeverityBadge(finding.severity)}
              <span className="font-mono text-xs text-[#6E5D4F]">ID: {finding.id}</span>
            </div>
            <h2 className="text-xl font-bold text-[#3B2A1C] flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-[#8B6F5B]" />
              {finding.label}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#FAF6F0] text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#FAF6F0] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-[#5A4D3B]">
          {/* Diagnostic Metrics Strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white border border-[#D9C6B7] space-y-1">
              <span className="text-[10px] text-[#6E5D4F] uppercase tracking-wider block">Confidence Score</span>
              <span className="text-base font-bold font-mono text-[#8B6F5B]">
                {finding.confidence !== undefined && finding.confidence !== null
                  ? `${(finding.confidence * 100).toFixed(1)}%`
                  : 'N/A'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#D9C6B7] space-y-1">
              <span className="text-[10px] text-[#6E5D4F] uppercase tracking-wider block">Source Modality</span>
              <span className="text-sm font-semibold text-[#3B2A1C]">
                {finding.provenance.modality?.replace('_', ' ') || 'Diagnostic Imaging'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#D9C6B7] space-y-1">
              <span className="text-[10px] text-[#6E5D4F] uppercase tracking-wider block">Evidence Citations</span>
              <span className="text-sm font-bold text-[#3B2A1C]">
                {finding.supporting_evidence_ids.length} Linked Items
              </span>
            </div>
          </div>

          {/* Primary Evidence Anchor */}
          {primaryEvidence && (
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E5D4F] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#8B6F5B]" />
                Primary Grounding Evidence
              </span>
              <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#D9C6B7] space-y-2">
                <div className="flex items-center justify-between">
                  <EvidenceChip item={primaryEvidence} onClick={() => onSelectEvidenceItem(primaryEvidence)} />
                  <span className="text-[10px] text-[#6E5D4F] font-mono">
                    Created: {new Date(primaryEvidence.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-[#5A4D3B] leading-relaxed pt-1">
                  {primaryEvidence.summary}
                </p>
              </div>
            </div>
          )}

          {/* Provenance Trace Breadcrumbs */}
          <div className="p-3.5 rounded-xl bg-[#FCF9F5] border border-[#D9C6B7] space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E5D4F] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#8B6F5B]" />
              Direct Provenance Trace
            </span>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
              {finding.provenance.trace_path.map((step, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded bg-[#FAF6F0] text-[#3B2A1C] border border-[#D9C6B7]"
                >
                  {step}
                </span>
              ))}
            </div>
          </div>

          {/* Supporting Evidence Items List */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6E5D4F] flex items-center justify-between">
              <span>All Supporting Canonical Evidence Items</span>
              <span className="text-[10px] text-[#6E5D4F] font-normal">Click any item for full provenance</span>
            </span>

            {supportingItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {supportingItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-white border border-[#D9C6B7] flex items-center justify-between gap-2"
                  >
                    <EvidenceChip item={item} size="sm" onClick={() => onSelectEvidenceItem(item)} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectEvidenceItem(item)}
                      className="text-[10px] text-[#8B6F5B] hover:text-[#8B6F5B] px-2 h-7"
                    >
                      Trace
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-[#FAF6F0] text-[#6E5D4F] text-center italic">
                No secondary evidence linked yet.
              </div>
            )}
          </div>

          {/* Source Navigation Shortcuts */}
          <div className="p-3.5 rounded-xl bg-[#F2E4D5]/20 border border-cyan-900/30 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-cyan-200 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-[#8B6F5B]" />
                Source Navigation Shortcuts
              </div>
              <p className="text-[11px] text-[#6E5D4F]">Jump directly to source components for this finding.</p>
            </div>

            <div className="flex items-center gap-2">
              {finding.provenance.model_run_id && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigateToSource && onNavigateToSource('model_run', finding.provenance.model_run_id)}
                  className="text-xs bg-white border-[#D9C6B7] text-[#8B6F5B]"
                >
                  <Scan className="w-3 h-3 mr-1.5" />
                  Model Run
                </Button>
              )}
            </div>
          </div>

          {/* Clinical Notes & Recommendations */}
          {finding.clinical_notes && (
            <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#D9C6B7] space-y-1">
              <span className="text-[10px] text-[#6E5D4F] uppercase tracking-wider block">Clinical Notes</span>
              <p className="text-[#5A4D3B] leading-relaxed text-xs">{finding.clinical_notes}</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#D9C6B7] bg-white flex items-center justify-between text-xs text-[#6E5D4F]">
          <span>Provenance Verified • Canonical Architecture</span>
          <Button variant="outline" size="sm" onClick={onClose} className="border-[#D9C6B7] bg-[#FAF6F0] text-[#5A4D3B]">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
