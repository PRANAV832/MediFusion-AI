import React, { useState } from 'react';
import type { StructuredConflictItem, ConflictSeverity } from '../../types/api';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface EvidenceComparisonCardProps {
  conflict: StructuredConflictItem;
  onResolve?: (conflictId: string, status: string, notes: string) => Promise<void>;
}

export const getSeverityBadge = (severity: ConflictSeverity) => {
  switch (severity) {
    case 'CRITICAL':
      return <Badge className="bg-rose-950 text-rose-300 border border-rose-600 font-bold">CRITICAL</Badge>;
    case 'HIGH':
      return <Badge className="bg-orange-950 text-orange-300 border border-orange-600 font-semibold">HIGH</Badge>;
    case 'MODERATE':
      return <Badge className="bg-amber-950 text-amber-300 border border-amber-600">MODERATE</Badge>;
    case 'LOW':
      return <Badge className="bg-blue-950 text-blue-300 border border-blue-600">LOW</Badge>;
  }
};

export const EvidenceComparisonCard: React.FC<EvidenceComparisonCardProps> = ({
  conflict,
  onResolve,
}) => {
  const [resolving, setResolving] = useState<boolean>(false);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [showResolveModal, setShowResolveModal] = useState<boolean>(false);
  const [expandedDetails, setExpandedDetails] = useState<boolean>(true);

  const isResolved = conflict.status === 'RESOLVED';
  const a = conflict.evidence_a;
  const b = conflict.evidence_b;

  const handleConfirmResolve = async () => {
    if (!onResolve || !resolutionNotes.trim()) return;
    setResolving(true);
    try {
      await onResolve(conflict.id, 'RESOLVED', resolutionNotes);
      setShowResolveModal(false);
    } finally {
      setResolving(false);
    }
  };

  return (
    <Card className="p-5 bg-white border-[#D9C6B7] shadow-xl space-y-4 transition-all">
      {/* Header Strip */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#D9C6B7] pb-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {getSeverityBadge(conflict.severity)}
            <Badge variant="outline" className="text-xs bg-[#FAF6F0] border-[#D9C6B7] text-[#5A4D3B] font-mono">
              {conflict.conflict_type.replace(/_/g, ' ')}
            </Badge>

            {isResolved ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" />
                Resolved by Clinician
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Clock className="w-3 h-3" />
                Action Required
              </span>
            )}

            <span className="text-[10px] font-mono text-[#6E5D4F]">ID: {conflict.id}</span>
          </div>

          <h3 className="text-base font-bold text-[#3B2A1C] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            {conflict.title}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {!isResolved && (
            <Button
              size="sm"
              onClick={() => setShowResolveModal(true)}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold"
            >
              <UserCheck className="w-3.5 h-3.5 mr-1" />
              Adjudicate
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpandedDetails(!expandedDetails)}
            className="text-xs text-[#6E5D4F] hover:text-[#3B2A1C] h-8 px-2"
          >
            {expandedDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EVIDENCE A VERSUS EVIDENCE B SIDE-BY-SIDE COMPARISON */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-11 gap-3 items-stretch">
        {/* Evidence A Card (5 Cols) */}
        <div className="lg:col-span-5 p-4 rounded-xl bg-white border border-cyan-900/50 space-y-2.5 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Badge className="bg-[#F2E4D5] text-[#8B6F5B] border border-[#D9C6B7] text-[10px] font-bold tracking-wider">
                EVIDENCE A
              </Badge>
              <span className="text-[10px] font-mono text-[#6E5D4F]">{a.source_type}</span>
            </div>

            <h4 className="text-sm font-bold text-cyan-200">{a.title}</h4>
            <p className="text-xs text-[#5A4D3B] leading-relaxed">{a.summary}</p>

            {a.excerpt && (
              <div className="p-2.5 rounded bg-white border border-[#D9C6B7] text-[11px] font-mono text-[#5A4D3B]">
                "{a.excerpt}"
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#D9C6B7]">
            {a.confidence !== undefined && a.confidence !== null && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#6E5D4F]">Model Probability:</span>
                <span className="font-mono font-bold text-[#8B6F5B]">{(a.confidence * 100).toFixed(1)}%</span>
              </div>
            )}

            {a.provenance_trace.length > 0 && (
              <div className="text-[10px] text-[#6E5D4F] font-mono truncate">
                Trace: {a.provenance_trace.join(' → ')}
              </div>
            )}
          </div>
        </div>

        {/* VS Central Divider Badge (1 Col) */}
        <div className="lg:col-span-1 flex items-center justify-center py-2 lg:py-0">
          <div className="w-10 h-10 rounded-full bg-[#FAF6F0] border border-[#D9C6B7] flex items-center justify-center text-xs font-black font-mono text-amber-400 shadow-md">
            VS
          </div>
        </div>

        {/* Evidence B Card (5 Cols) */}
        <div className="lg:col-span-5 p-4 rounded-xl bg-white border border-rose-900/50 space-y-2.5 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Badge className="bg-rose-950 text-rose-300 border border-rose-700 text-[10px] font-bold tracking-wider">
                EVIDENCE B
              </Badge>
              <span className="text-[10px] font-mono text-[#6E5D4F]">{b.source_type}</span>
            </div>

            <h4 className="text-sm font-bold text-rose-200">{b.title}</h4>
            <p className="text-xs text-[#5A4D3B] leading-relaxed">{b.summary}</p>

            {b.excerpt && (
              <div className="p-2.5 rounded bg-white border border-[#D9C6B7] text-[11px] font-mono text-[#5A4D3B]">
                "{b.excerpt}"
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#D9C6B7]">
            {b.confidence !== undefined && b.confidence !== null && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#6E5D4F]">Model Probability:</span>
                <span className="font-mono font-bold text-rose-300">{(b.confidence * 100).toFixed(1)}%</span>
              </div>
            )}

            {b.provenance_trace.length > 0 && (
              <div className="text-[10px] text-[#6E5D4F] font-mono truncate">
                Trace: {b.provenance_trace.join(' → ')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CLINICAL TENSION EXPLANATION & WHY HUMAN REVIEW IS REQUIRED */}
      {/* ========================================================================= */}
      {expandedDetails && (
        <div className="space-y-3 pt-1">
          {/* Why They Conflict */}
          <div className="p-3.5 rounded-xl bg-white border border-amber-500/30 text-xs text-[#5A4D3B] leading-relaxed shadow-sm">
            <div className="font-bold flex items-center gap-1.5 text-amber-300 text-xs uppercase tracking-wider mb-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Why They Conflict (Evidentiary Tension)
            </div>
            <p className="text-[#3B2A1C] leading-relaxed">{conflict.explanation}</p>
          </div>

          {/* Mandatory "Why Review is Required" Callout */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/60 to-rose-950/40 border border-amber-500/60 text-xs text-amber-200 space-y-1.5 shadow-md">
            <div className="font-bold flex items-center gap-1.5 text-amber-300 text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Why Review is Required (Safety Gate)
            </div>
            <p className="text-amber-100/90 leading-relaxed text-xs">
              {conflict.why_human_review_required}
            </p>
          </div>

          {/* Clinical Implication & Recommended Action */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {conflict.clinical_implication && (
              <div className="p-3 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] space-y-1">
                <span className="text-[10px] text-[#6E5D4F] uppercase tracking-wider block font-semibold">
                  Diagnostic & Safety Implication
                </span>
                <p className="text-[#5A4D3B] leading-relaxed">{conflict.clinical_implication}</p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-[#FAF6F0] border border-cyan-900/40 space-y-1">
              <span className="text-[10px] text-[#8B6F5B] uppercase tracking-wider block font-semibold">
                Recommended Clinical Action
              </span>
              <p className="text-cyan-200 leading-relaxed">{conflict.recommended_action}</p>
            </div>
          </div>

          {/* Resolution Notes Display (if resolved) */}
          {isResolved && conflict.resolution_notes && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-200 space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Clinician Adjudication Recorded
              </div>
              <p className="text-emerald-300/90 italic">"{conflict.resolution_notes}"</p>
            </div>
          )}
        </div>
      )}

      {/* Clinician Adjudication Modal Dialog */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-[#D9C6B7] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="space-y-1">
              <h4 className="text-base font-bold text-[#3B2A1C] flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                Clinician Conflict Adjudication
              </h4>
              <p className="text-xs text-[#6E5D4F]">
                Document your diagnostic determination to resolve this conflict.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5A4D3B] mb-1.5 uppercase tracking-wider">
                Clinical Adjudication Notes & Rationale
              </label>
              <textarea
                rows={4}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="e.g. Reviewed PA radiograph: clear retrocardiac opacity represents true acute bacterial consolidation rather than baseline scarring. Antibiotics initiated."
                className="w-full px-3 py-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] placeholder:text-[#6E5D4F] text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D9C6B7]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResolveModal(false)}
                disabled={resolving}
                className="border-[#D9C6B7] bg-[#FAF6F0] text-[#5A4D3B] text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmResolve}
                disabled={!resolutionNotes.trim() || resolving}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs"
              >
                {resolving ? 'Recording...' : 'Confirm Resolution'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
