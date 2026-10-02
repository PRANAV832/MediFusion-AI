import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/apiClient';
import type {
  CanonicalCaseEvidenceGraph,
  CanonicalEvidenceItem,
  CanonicalFinding,
  CanonicalEvidenceType,
} from '../../types/api';
import { EvidenceChip } from './EvidenceChip';
import { ProvenanceDrawer } from './ProvenanceDrawer';
import { FindingDetailsModal, getSeverityBadge, getStatusBadge } from './FindingDetailsModal';
import {
  Layers,
  ShieldCheck,
  RefreshCw,
  Search,
  Scan,
  FileText,
  BookOpen,
  Sparkles,
  ChevronRight,
  Info,
  Stethoscope,
  AlertCircle,
} from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface CanonicalEvidenceExplorerProps {
  caseId: string;
  patientId?: string;
  onNavigateToTab?: (tab: string) => void;
}

export const CanonicalEvidenceExplorer: React.FC<CanonicalEvidenceExplorerProps> = ({
  caseId,
  patientId,
  onNavigateToTab,
}) => {
  const [evidenceGraph, setEvidenceGraph] = useState<CanonicalCaseEvidenceGraph | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter state
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<CanonicalEvidenceType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Drawers and Modals state
  const [selectedEvidenceItem, setSelectedEvidenceItem] = useState<CanonicalEvidenceItem | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<CanonicalFinding | null>(null);

  // Fetch canonical evidence graph
  const loadEvidenceGraph = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const graph = await apiClient.getCaseEvidenceGraph(caseId, patientId);
      setEvidenceGraph(graph);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load canonical evidence graph';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [caseId, patientId]);

  useEffect(() => {
    loadEvidenceGraph();
  }, [loadEvidenceGraph]);

  // Source Navigation callback
  const handleNavigateToSource = (sourceType: string, _sourceId?: string) => {
    if (!onNavigateToTab) return;
    if (sourceType === 'model_run') {
      onNavigateToTab('screening');
    } else if (sourceType === 'rag_chunk') {
      onNavigateToTab('knowledge');
    } else if (sourceType === 'gemini_synthesis') {
      onNavigateToTab('gemini');
    }
  };

  // Filter evidence items
  const filteredEvidenceItems = (evidenceGraph?.evidence_items || []).filter((item) => {
    if (selectedTypeFilter !== 'ALL' && item.evidence_type !== selectedTypeFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(query);
      const matchSummary = item.summary.toLowerCase().includes(query);
      const matchId = item.id.toLowerCase().includes(query);
      return matchTitle || matchSummary || matchId;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* HEADER & SUMMARY METRICS BANNER */}
      {/* ========================================================================= */}
      <Card className="p-5 bg-white border-[#D9C6B7] shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#F2E4D5]/80 text-[#8B6F5B] border border-[#D9C6B7] text-xs py-0.5">
                PHASE 11
              </Badge>
              <Badge className="bg-[#FAF6F0] text-[#5A4D3B] border border-[#D9C6B7] text-xs py-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Anti-Self-Referencing Guard Active
              </Badge>
            </div>

            <h2 className="text-xl font-bold text-[#3B2A1C] flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#8B6F5B]" />
              Canonical Evidence & Provenance System
            </h2>
            <p className="text-xs text-[#6E5D4F]">
              Deterministic, bidirectional evidence DAG across specialized AI models, patient records, trusted clinical knowledge, and grounded synthesis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadEvidenceGraph}
              disabled={loading}
              className="text-xs border-[#D9C6B7] bg-[#FAF6F0] hover:bg-[#FAF6F0] text-[#3B2A1C]"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Graph
            </Button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Critical Invariant Banner */}
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/50 text-xs text-amber-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold text-amber-300">
              Critical Architectural Invariant: GENERATED_SYNTHESIS Cannot Support Itself
            </div>
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              Every synthesized claim must trace back to concrete underlying evidence: <strong>MODEL_FINDING</strong>, <strong>PATIENT_RECORD</strong>, or <strong>TRUSTED_KNOWLEDGE</strong>. Self-referencing or circular synthesis-only support loops are rejected by server-side validation.
            </p>
          </div>
        </div>

        {/* Graph Statistics Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
          <div className="p-3 rounded-xl bg-white border border-[#D9C6B7] space-y-1">
            <span className="text-[10px] text-[#6E5D4F] uppercase tracking-wider block">Total Items</span>
            <span className="text-lg font-bold font-mono text-[#3B2A1C]">
              {evidenceGraph?.stats.total_evidence_items ?? 0}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-cyan-900/40 space-y-1">
            <span className="text-[10px] text-[#8B6F5B] uppercase tracking-wider block flex items-center gap-1">
              <Scan className="w-2.5 h-2.5" />
              Model Findings
            </span>
            <span className="text-lg font-bold font-mono text-[#8B6F5B]">
              {evidenceGraph?.stats.model_findings_count ?? 0}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-rose-900/40 space-y-1">
            <span className="text-[10px] text-rose-400 uppercase tracking-wider block flex items-center gap-1">
              <FileText className="w-2.5 h-2.5" />
              Patient Records
            </span>
            <span className="text-lg font-bold font-mono text-rose-300">
              {evidenceGraph?.stats.patient_records_count ?? 0}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-purple-900/40 space-y-1">
            <span className="text-[10px] text-purple-400 uppercase tracking-wider block flex items-center gap-1">
              <BookOpen className="w-2.5 h-2.5" />
              Knowledge
            </span>
            <span className="text-lg font-bold font-mono text-purple-300">
              {evidenceGraph?.stats.trusted_knowledge_count ?? 0}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-amber-900/40 space-y-1">
            <span className="text-[10px] text-amber-400 uppercase tracking-wider block flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Synthesis
            </span>
            <span className="text-lg font-bold font-mono text-amber-300">
              {evidenceGraph?.stats.generated_synthesis_count ?? 0}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white border border-emerald-900/40 space-y-1">
            <span className="text-[10px] text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
              <Stethoscope className="w-2.5 h-2.5" />
              Findings
            </span>
            <span className="text-lg font-bold font-mono text-emerald-300">
              {evidenceGraph?.stats.findings_count ?? 0}
            </span>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* CLINICAL FINDINGS SECTION */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#3B2A1C] flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-[#8B6F5B]" />
            Evaluated Clinical Findings ({evidenceGraph?.findings.length ?? 0})
          </h3>
          <span className="text-xs text-[#6E5D4F]">
            Click any finding card for full clinical details and supporting evidence graph
          </span>
        </div>

        {evidenceGraph?.findings && evidenceGraph.findings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {evidenceGraph.findings.map((finding) => (
              <div
                key={finding.id}
                onClick={() => setSelectedFinding(finding)}
                className="p-4 rounded-xl bg-white border border-[#D9C6B7] hover:border-[#D9C6B7]/60 transition-all cursor-pointer shadow-md hover:shadow-lg space-y-3 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(finding.status)}
                      {getSeverityBadge(finding.severity)}
                    </div>
                    <h4 className="text-sm font-bold text-[#3B2A1C] group-hover:text-[#8B6F5B] transition-colors">
                      {finding.label}
                    </h4>
                  </div>

                  {finding.confidence !== undefined && finding.confidence !== null && (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#FAF6F0] text-[#8B6F5B] border border-[#D9C6B7]">
                      {(finding.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* Direct Provenance Trace snippet */}
                <div className="p-2 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] text-[11px] font-mono text-[#6E5D4F] truncate">
                  {finding.provenance.trace_path.join(' → ')}
                </div>

                <div className="flex items-center justify-between text-xs text-[#6E5D4F] pt-1 border-t border-[#D9C6B7]">
                  <span>{finding.supporting_evidence_ids.length} Linked Citations</span>
                  <span className="text-[#8B6F5B] group-hover:underline flex items-center gap-1 text-[11px]">
                    Details & Trace <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-white border border-[#D9C6B7] text-center text-xs text-[#6E5D4F]">
            No clinical findings registered yet for this case. Run a specialized screening model to generate canonical findings.
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* EVIDENCE INVENTORY & FILTER BAR */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#FAF6F0] rounded-xl border border-[#D9C6B7] text-xs">
            <button
              type="button"
              onClick={() => setSelectedTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedTypeFilter === 'ALL'
                  ? 'bg-[#FAF6F0] text-[#3B2A1C] shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
              }`}
            >
              All Types ({evidenceGraph?.evidence_items.length ?? 0})
            </button>

            <button
              type="button"
              onClick={() => setSelectedTypeFilter('MODEL_FINDING')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedTypeFilter === 'MODEL_FINDING'
                  ? 'bg-[#F2E4D5] text-cyan-200 border border-[#D9C6B7]/80 shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#8B6F5B]'
              }`}
            >
              <Scan className="w-3 h-3 text-[#8B6F5B]" />
              Model Finding ({evidenceGraph?.stats.model_findings_count ?? 0})
            </button>

            <button
              type="button"
              onClick={() => setSelectedTypeFilter('PATIENT_RECORD')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedTypeFilter === 'PATIENT_RECORD'
                  ? 'bg-rose-950 text-rose-200 border border-rose-800/80 shadow-sm'
                  : 'text-[#6E5D4F] hover:text-rose-300'
              }`}
            >
              <FileText className="w-3 h-3 text-rose-400" />
              Patient Record ({evidenceGraph?.stats.patient_records_count ?? 0})
            </button>

            <button
              type="button"
              onClick={() => setSelectedTypeFilter('TRUSTED_KNOWLEDGE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedTypeFilter === 'TRUSTED_KNOWLEDGE'
                  ? 'bg-purple-950 text-purple-200 border border-purple-800/80 shadow-sm'
                  : 'text-[#6E5D4F] hover:text-purple-300'
              }`}
            >
              <BookOpen className="w-3 h-3 text-purple-400" />
              Trusted Knowledge ({evidenceGraph?.stats.trusted_knowledge_count ?? 0})
            </button>

            <button
              type="button"
              onClick={() => setSelectedTypeFilter('GENERATED_SYNTHESIS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedTypeFilter === 'GENERATED_SYNTHESIS'
                  ? 'bg-amber-950 text-amber-200 border border-amber-800/80 shadow-sm'
                  : 'text-[#6E5D4F] hover:text-amber-300'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              Generated Synthesis ({evidenceGraph?.stats.generated_synthesis_count ?? 0})
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#6E5D4F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evidence by title/id..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg text-xs text-[#3B2A1C] placeholder:text-[#6E5D4F] focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        {/* Evidence Grid */}
        {filteredEvidenceItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredEvidenceItems.map((item) => {
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-white border border-[#D9C6B7] hover:border-[#D9C6B7] transition-all space-y-3 flex flex-col justify-between shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <EvidenceChip item={item} onClick={() => setSelectedEvidenceItem(item)} />
                      <span className="font-mono text-[10px] text-[#6E5D4F] shrink-0">
                        {item.id}
                      </span>
                    </div>

                    <p className="text-xs text-[#5A4D3B] leading-relaxed line-clamp-3">
                      {item.summary}
                    </p>
                  </div>

                  {/* Provenance trace path bar */}
                  <div className="p-2.5 rounded-lg bg-white border border-[#D9C6B7] space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#6E5D4F] block">
                      Provenance Chain
                    </span>
                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-[#5A4D3B] font-mono">
                      {item.provenance.trace_path.map((step, idx) => (
                        <React.Fragment key={idx}>
                          <span className="bg-white px-1.5 py-0.5 rounded border border-[#D9C6B7]">
                            {step}
                          </span>
                          {idx < item.provenance.trace_path.length - 1 && (
                            <span className="text-[#6E5D4F]">→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#D9C6B7] text-xs">
                    <span className="text-[#6E5D4F] text-[11px]">
                      {item.event_date ? `Date: ${item.event_date}` : 'Canonical Archive'}
                    </span>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedEvidenceItem(item)}
                      className="text-xs text-[#8B6F5B] hover:text-[#8B6F5B] hover:bg-[#FAF6F0] h-7 px-2"
                    >
                      Inspect Provenance <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-10 rounded-2xl bg-white/50 border border-[#D9C6B7] text-center space-y-2">
            <p className="text-xs text-[#6E5D4F]">
              No canonical evidence items match your active filter criteria.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedTypeFilter('ALL');
                setSearchQuery('');
              }}
              className="text-xs border-[#D9C6B7] bg-[#FAF6F0] text-[#5A4D3B]"
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PROVENANCE DRAWER & FINDING DETAILS MODAL */}
      {/* ========================================================================= */}
      <ProvenanceDrawer
        item={selectedEvidenceItem}
        onClose={() => setSelectedEvidenceItem(null)}
        onSelectEvidenceId={(id) => {
          const found = evidenceGraph?.evidence_items.find((e) => e.id === id);
          if (found) setSelectedEvidenceItem(found);
        }}
        onNavigateToSource={handleNavigateToSource}
      />

      <FindingDetailsModal
        finding={selectedFinding}
        allEvidenceItems={evidenceGraph?.evidence_items || []}
        onClose={() => setSelectedFinding(null)}
        onSelectEvidenceItem={(item) => setSelectedEvidenceItem(item)}
        onNavigateToSource={handleNavigateToSource}
      />
    </div>
  );
};
