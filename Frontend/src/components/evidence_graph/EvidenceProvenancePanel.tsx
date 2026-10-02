import React from 'react';
import type { EvidenceNodeData } from './EvidenceNodeComponent';
import {
  X,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface EvidenceProvenancePanelProps {
  node: EvidenceNodeData | null;
  onClose: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const EvidenceProvenancePanel: React.FC<EvidenceProvenancePanelProps> = ({
  node,
  onClose,
  onNavigateToTab,
}) => {
  if (!node) return null;

  const raw = node.rawItem || {};
  const prov = raw.provenance || {};

  const getSourceNavigation = () => {
    switch (node.nodeType) {
      case 'FINDING':
      case 'MODEL_FINDING':
      case 'MODEL_RUN':
        return { tab: 'screening', label: 'View Model Run Execution' };
      case 'SOURCE_ASSET':
        return null;
      case 'PATIENT_RECORD':
      case 'DOCUMENT':
      case 'CHUNK':
        return { tab: 'knowledge', label: 'View in Patient RAG Store' };
      case 'GENERATED_SYNTHESIS':
        return { tab: 'gemini', label: 'Inspect Gemini Synthesis Dossier' };
      case 'CONFLICT':
        return { tab: 'conflicts', label: 'Review Evidentiary Conflict' };
      default:
        return null;
    }
  };

  const nav = getSourceNavigation();

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white border-l border-[#D9C6B7] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#D9C6B7]">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge variant="outline" className="font-mono text-[10px] uppercase text-[#5A4D3B] border-[#D9C6B7] bg-[#F2E4D5]">
                {node.nodeType}
              </Badge>
              {node.confidence !== undefined && node.confidence !== null && (
                <Badge className="bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] text-[10px]">
                  Probability: {(node.confidence * 100).toFixed(1)}%
                </Badge>
              )}
            </div>
            <h2 className="text-base font-bold text-[#3B2A1C]">{node.label}</h2>
            {node.sublabel && <p className="text-xs text-[#6E5D4F] mt-0.5">{node.sublabel}</p>}
          </div>

          <button
            onClick={onClose}
            aria-label="Close panel"
            className="p-1.5 rounded-lg hover:bg-[#FAF6F0] text-[#6E5D4F] hover:text-[#3B2A1C] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provenance Hierarchy Breadcrumb */}
        {node.tracePath && node.tracePath.length > 0 && (
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#6E5D4F] uppercase tracking-wider block">
              Direct Provenance Chain
            </label>
            <div className="p-3 rounded-xl bg-[#FCF9F5] border border-[#D9C6B7] space-y-2">
              {node.tracePath.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span className="w-4 h-4 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center text-[10px] font-mono font-bold">
                    {idx + 1}
                  </span>
                  <span className="font-mono text-[#3B2A1C]">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Excerpt / Full Content */}
        {raw.content || raw.summary || node.excerpt ? (
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#6E5D4F] uppercase tracking-wider block">
              Grounded Content & Clinical Excerpt
            </label>
            <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#D9C6B7] text-xs text-[#3B2A1C] leading-relaxed max-h-48 overflow-y-auto">
              {raw.content || raw.summary || node.excerpt}
            </div>
          </div>
        ) : null}

        {/* Structured Provenance IDs */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-[#6E5D4F] uppercase tracking-wider block">
            Verification Metadata
          </label>
          <div className="p-3.5 rounded-xl bg-[#FCF9F5] border border-[#D9C6B7] space-y-2 text-xs font-mono">
            {prov.model_id && (
              <div className="flex justify-between text-[#6E5D4F]">
                <span>Model ID:</span>
                <span className="text-[#3B2A1C] font-semibold">{prov.model_id}</span>
              </div>
            )}
            {prov.model_run_id && (
              <div className="flex justify-between text-[#6E5D4F]">
                <span>Model Run:</span>
                <span className="text-[#8B6F5B] font-semibold">#{prov.model_run_id.slice(0, 8)}</span>
              </div>
            )}
            {prov.source_asset_filename && (
              <div className="flex justify-between text-[#6E5D4F]">
                <span>Asset File:</span>
                <span className="text-[#3B2A1C]">{prov.source_asset_filename}</span>
              </div>
            )}
            {prov.document_filename && (
              <div className="flex justify-between text-[#6E5D4F]">
                <span>Document:</span>
                <span className="text-[#3B2A1C]">{prov.document_filename}</span>
              </div>
            )}
            {prov.page_number !== undefined && (
              <div className="flex justify-between text-[#6E5D4F]">
                <span>Page:</span>
                <span className="text-[#3B2A1C]">{prov.page_number}</span>
              </div>
            )}
            {prov.citation_reference && (
              <div className="flex justify-between text-[#6E5D4F]">
                <span>Citation:</span>
                <span className="text-purple-700 truncate max-w-[200px]">{prov.citation_reference}</span>
              </div>
            )}
            {raw.id && (
              <div className="flex justify-between text-[#6E5D4F] pt-2 border-t border-[#D9C6B7]">
                <span>Canonical ID:</span>
                <span className="text-[#6E5D4F]">{raw.id}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Jump Button */}
      {nav && onNavigateToTab && (
        <div className="pt-6 border-t border-[#D9C6B7] mt-6">
          <Button
            onClick={() => {
              onNavigateToTab(nav.tab);
              onClose();
            }}
            className="w-full bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm"
          >
            <span>{nav.label}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

