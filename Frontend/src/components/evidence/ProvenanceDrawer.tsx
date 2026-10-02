import React from 'react';
import type { CanonicalEvidenceItem } from '../../types/api';
import { getEvidenceTypeStyles } from './EvidenceChip';
import {
  X,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Clock,
  Tag,
  FileText,
  Scan,
  BookOpen,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface ProvenanceDrawerProps {
  item: CanonicalEvidenceItem | null;
  onClose: () => void;
  onSelectEvidenceId?: (id: string) => void;
  onNavigateToSource?: (sourceType: string, sourceId?: string) => void;
}

export const ProvenanceDrawer: React.FC<ProvenanceDrawerProps> = ({
  item,
  onClose,
  onSelectEvidenceId,
  onNavigateToSource,
}) => {
  if (!item) return null;

  const styles = getEvidenceTypeStyles(item.evidence_type);
  const Icon = styles.icon;
  const prov = item.provenance;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#FCF9F5] backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white border-l border-[#D9C6B7] shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#D9C6B7] bg-white flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className={`${styles.badgeBg} flex items-center gap-1 text-xs py-0.5 font-semibold`}>
                <Icon className="w-3.5 h-3.5" />
                {styles.label}
              </Badge>

              <span className="font-mono text-[11px] text-[#6E5D4F]">
                ID: {item.id}
              </span>
            </div>

            <h2 className="text-base font-bold text-[#3B2A1C] flex items-center gap-2">
              {item.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#FAF6F0] text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#FAF6F0] transition-colors"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Provenance Hierarchy Breadcrumb Chain */}
          <div className="p-4 rounded-xl bg-white border border-[#D9C6B7] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E5D4F] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#8B6F5B]" />
                Canonical Provenance Trace Chain
              </span>
              <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-800/60 bg-emerald-950/40">
                Verified
              </Badge>
            </div>

            <div className="p-3 rounded-lg bg-white border border-[#D9C6B7]">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {prov?.trace_path && prov.trace_path.length > 0 ? (
                  prov.trace_path.map((step, idx) => (
                    <React.Fragment key={idx}>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#FAF6F0] text-[#3B2A1C] font-semibold border border-[#D9C6B7]">
                        {step}
                      </span>
                      {idx < prov.trace_path.length - 1 && (
                        <ChevronRight className="w-3.5 h-3.5 text-[#6E5D4F] shrink-0" />
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <span className="text-[#6E5D4F] text-xs italic">Provenance trace verified directly.</span>
                )}
              </div>
            </div>

            {/* Explanatory description of hierarchy rule */}
            <p className="text-[11px] text-[#6E5D4F]">
              {item.evidence_type === 'MODEL_FINDING' && (
                <>Hierarchical Linkage: <strong className="text-[#5A4D3B]">Model</strong> → <strong className="text-[#5A4D3B]">Model Run</strong> → <strong className="text-[#5A4D3B]">Source Asset</strong></>
              )}
              {item.evidence_type === 'PATIENT_RECORD' && (
                <>Hierarchical Linkage: <strong className="text-[#5A4D3B]">Document</strong> → <strong className="text-[#5A4D3B]">Page</strong> → <strong className="text-[#5A4D3B]">Chunk</strong></>
              )}
              {item.evidence_type === 'TRUSTED_KNOWLEDGE' && (
                <>Hierarchical Linkage: <strong className="text-[#5A4D3B]">Source Organization</strong> → <strong className="text-[#5A4D3B]">Document / Guideline</strong></>
              )}
              {item.evidence_type === 'GENERATED_SYNTHESIS' && (
                <>Hierarchical Linkage: <strong className="text-[#5A4D3B]">Gemini LLM</strong> → <strong className="text-[#5A4D3B]">Supporting Evidence IDs</strong></>
              )}
            </p>
          </div>

          {/* Source Navigation Action Bar */}
          <div className="p-3.5 rounded-xl bg-[#F2E4D5] border border-cyan-900/40 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-cyan-200 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-[#8B6F5B]" />
                Source Navigation
              </div>
              <p className="text-[11px] text-[#6E5D4F]">
                Direct deep-link to the authoritative origin of this evidence item.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {item.evidence_type === 'MODEL_FINDING' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigateToSource && onNavigateToSource('model_run', prov?.model_run_id)}
                  className="text-xs bg-white border-[#D9C6B7] text-[#8B6F5B] hover:bg-[#F2E4D5]"
                >
                  <Scan className="w-3 h-3 mr-1.5" />
                  View Model Run
                </Button>
              )}

              {item.evidence_type === 'PATIENT_RECORD' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigateToSource && onNavigateToSource('rag_chunk', prov?.chunk_id)}
                  className="text-xs bg-white border-rose-800 text-rose-300 hover:bg-rose-950"
                >
                  <FileText className="w-3 h-3 mr-1.5" />
                  View in RAG Store
                </Button>
              )}

              {item.evidence_type === 'TRUSTED_KNOWLEDGE' && prov?.citation_reference && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigateToSource && onNavigateToSource('guideline', prov?.source_name)}
                  className="text-xs bg-white border-purple-800 text-purple-300 hover:bg-purple-950"
                >
                  <BookOpen className="w-3 h-3 mr-1.5" />
                  Clinical Citation
                </Button>
              )}

              {item.evidence_type === 'GENERATED_SYNTHESIS' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigateToSource && onNavigateToSource('gemini_synthesis', item.id)}
                  className="text-xs bg-white border-amber-800 text-amber-300 hover:bg-amber-950"
                >
                  <Sparkles className="w-3 h-3 mr-1.5" />
                  Gemini Synthesis
                </Button>
              )}
            </div>
          </div>

          {/* Critical Rule Callout for Synthesis */}
          {item.evidence_type === 'GENERATED_SYNTHESIS' && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Anti-Self-Referencing Constraint Enforced
              </div>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                By architectural requirement, <strong>GENERATED_SYNTHESIS cannot support itself</strong>. It must point to actual evidence (Model Findings, Patient Records, or Trusted Knowledge).
              </p>
            </div>
          )}

          {/* Evidence Details & Content Box */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A4D3B]">
              Evidence Content & Clinical Summary
            </h3>
            <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#D9C6B7] space-y-3 text-xs leading-relaxed text-[#3B2A1C]">
              <div className="font-medium text-[#3B2A1C]">
                {item.summary}
              </div>
              {item.content && item.content !== item.summary && (
                <div className="pt-3 border-t border-[#D9C6B7] text-[#6E5D4F] font-mono text-[11px] whitespace-pre-wrap bg-white/50 p-2.5 rounded-lg">
                  {item.content}
                </div>
              )}
            </div>
          </div>

          {/* Supporting Evidence Citations (For Synthesis) */}
          {item.evidence_type === 'GENERATED_SYNTHESIS' && prov?.supporting_evidence_ids && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A4D3B] flex items-center justify-between">
                <span>Supporting Evidence Citations ({prov.supporting_evidence_ids.length})</span>
                <span className="text-[10px] text-[#6E5D4F] font-normal">Click ID to inspect</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {prov.supporting_evidence_ids.map((citeId) => (
                  <button
                    key={citeId}
                    type="button"
                    onClick={() => onSelectEvidenceId && onSelectEvidenceId(citeId)}
                    className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#FAF6F0] text-[#8B6F5B] border border-[#D9C6B7] font-mono text-xs flex items-center gap-1 transition-colors"
                  >
                    <Tag className="w-3 h-3 text-[#8B6F5B]" />
                    {citeId}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A4D3B]">
              Item Attributes & Metadata
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] space-y-1">
                <span className="text-[10px] text-[#6E5D4F] uppercase tracking-wider block">Evidence Type</span>
                <span className="font-semibold text-[#3B2A1C]">{item.evidence_type}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] space-y-1">
                <span className="text-[10px] text-[#6E5D4F] uppercase tracking-wider block">Confidence Score</span>
                <span className="font-semibold text-[#3B2A1C]">
                  {item.confidence !== undefined && item.confidence !== null ? (
                    <span className="font-mono text-[#8B6F5B]">{(item.confidence * 100).toFixed(1)}%</span>
                  ) : (
                    <span className="text-[#6E5D4F] italic">N/A (Unmanipulated)</span>
                  )}
                </span>
              </div>

              {item.modality && (
                <div className="p-2.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] space-y-1">
                  <span className="text-[10px] text-[#6E5D4F] uppercase tracking-wider block">Modality</span>
                  <span className="font-semibold text-[#3B2A1C] capitalize">{item.modality.replace('_', ' ')}</span>
                </div>
              )}

              {item.event_date && (
                <div className="p-2.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] space-y-1">
                  <span className="text-[10px] text-[#6E5D4F] uppercase tracking-wider block">Clinical Date</span>
                  <span className="font-semibold text-[#3B2A1C]">{item.event_date}</span>
                </div>
              )}

              {prov?.source_asset_filename && (
                <div className="p-2.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] space-y-1 col-span-2">
                  <span className="text-[10px] text-[#6E5D4F] uppercase tracking-wider block">Source Filename</span>
                  <span className="font-mono text-[#5A4D3B] truncate block">{prov.source_asset_filename}</span>
                </div>
              )}

              {prov?.citation_reference && (
                <div className="p-2.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] space-y-1 col-span-2">
                  <span className="text-[10px] text-[#6E5D4F] uppercase tracking-wider block">Citation Reference</span>
                  <span className="text-purple-300 text-[11px] block">{prov.citation_reference}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-[#D9C6B7] bg-white flex items-center justify-between text-xs text-[#6E5D4F]">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-[#6E5D4F]" />
            Created: {new Date(item.created_at).toLocaleString()}
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs border-[#D9C6B7] bg-[#FAF6F0] text-[#5A4D3B]">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
