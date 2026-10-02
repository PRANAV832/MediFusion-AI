import React, { useState, useEffect } from 'react';
import {
  GitCommit,
  Info,
  Scale,
  Sparkles,
  FileText,
  Brain,
  BookOpen,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/apiClient';
import type { EvidenceSensitivityAssessment, EvidenceContributionItem } from '../../types/api';

interface EvidenceSensitivityViewProps {
  caseId: string;
}

export const EvidenceSensitivityView: React.FC<EvidenceSensitivityViewProps> = ({ caseId }) => {
  const [assessment, setAssessment] = useState<EvidenceSensitivityAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<EvidenceContributionItem | null>(null);

  const fetchSensitivity = async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCaseSensitivity(caseId);
      setAssessment(data);
      if (data.contributions.length > 0) {
        setSelectedItem(data.contributions[0]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load evidence sensitivity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSensitivity();
  }, [caseId]);

  const getEvidenceTypeIcon = (type: string) => {
    switch (type) {
      case 'MODEL_FINDING':
        return <Brain className="w-4 h-4 text-purple-400" />;
      case 'PATIENT_RECORD':
        return <FileText className="w-4 h-4 text-sky-400" />;
      case 'TRUSTED_KNOWLEDGE':
        return <BookOpen className="w-4 h-4 text-emerald-400" />;
      default:
        return <GitCommit className="w-4 h-4 text-indigo-400" />;
    }
  };

  const getInfluenceBadge = (influence: string) => {
    switch (influence) {
      case 'SUPPORTIVE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 uppercase">
            Supportive
          </span>
        );
      case 'QUALIFYING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase">
            Qualifying
          </span>
        );
      case 'CONTRADICTORY':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30 uppercase">
            Contradictory Tension
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white border border-[#D9C6B7] rounded-xl p-6 text-[#3B2A1C] shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#D9C6B7]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#3B2A1C] tracking-wide">
                EVIDENCE SENSITIVITY & GROUNDING
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Synthesis Attribution
              </span>
            </div>
            <p className="text-xs text-[#6E5D4F] mt-0.5">
              Quantitative trace of contributing canonical evidence items to the clinical intelligence narrative.
            </p>
          </div>
        </div>

        <button
          onClick={fetchSensitivity}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FAF6F0] hover:bg-[#FAF6F0] text-[#3B2A1C] text-xs font-medium border border-[#D9C6B7] transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Analysis</span>
        </button>
      </div>

      {/* Mandatory Non-Causal Disclaimer Banner */}
      <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/50 text-amber-200 text-xs space-y-1.5 shadow-sm">
        <div className="font-bold flex items-center gap-2 text-amber-300 tracking-wide uppercase">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          MANDATORY NON-CAUSAL DISCLAIMER
        </div>
        <p className="text-amber-200/90 leading-relaxed font-sans">
          {assessment?.non_causal_disclaimer ||
            'NON-CAUSAL DISCLAIMER: Evidence sensitivity metrics represent algorithmic attribution and textual grounding weights within the generated clinical intelligence summary. They DO NOT establish biological etiology, medical causation, or diagnostic certainty. All clinical interpretations require validated physician evaluation.'}
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Synthesis Context Preview */}
      {assessment && (
        <div className="p-4 rounded-xl bg-[#FCF9F5] border border-[#D9C6B7] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#5A4D3B] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Generated Synthesis Preview
            </span>
            <span className="text-[#6E5D4F] font-mono">
              Total Contributing Items: {assessment.total_contributing_items} ({assessment.primary_contributors_count} Primary)
            </span>
          </div>
          <p className="text-xs text-[#5A4D3B] italic bg-white p-3 rounded-lg border border-[#D9C6B7]">
            "{assessment.synthesis_preview}"
          </p>
        </div>
      )}

      {/* Main Sensitivity Matrix (List + Detail Inspector) */}
      {assessment && assessment.contributions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Contribution Items & Weight Bars */}
          <div className="lg:col-span-7 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#6E5D4F]">
              Contributing Canonical Evidence Items
            </div>

            <div className="space-y-2.5">
              {assessment.contributions.map((item) => {
                const isSelected = selectedItem?.evidence_id === item.evidence_id;
                return (
                  <div
                    key={item.evidence_id}
                    onClick={() => setSelectedItem(item)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#FAF6F0]/90 border-teal-500/60 ring-1 ring-teal-500/30'
                        : 'bg-[#FCF9F5] border-[#D9C6B7] hover:bg-[#FAF6F0]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 p-1 rounded bg-white border border-[#D9C6B7]">
                          {getEvidenceTypeIcon(item.evidence_type)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#3B2A1C]">{item.title}</div>
                          <div className="text-[11px] text-[#6E5D4F] font-mono mt-0.5">
                            {item.source_provenance}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1.5 justify-end">
                          {getInfluenceBadge(item.influence_nature)}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                              item.contribution_level === 'PRIMARY'
                                ? 'bg-teal-500/20 text-teal-300'
                                : 'bg-[#FAF6F0] text-[#6E5D4F]'
                            }`}
                          >
                            {item.contribution_level}
                          </span>
                        </div>
                        <div className="text-sm font-bold font-mono text-teal-300 mt-1">
                          {item.contribution_percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Progress attribution bar */}
                    <div className="w-full bg-white h-1.5 rounded-full overflow-hidden border border-[#D9C6B7] mt-2">
                      <div
                        className={`h-full transition-all duration-500 ${
                          item.contribution_level === 'PRIMARY'
                            ? 'bg-gradient-to-r from-teal-500 to-emerald-400'
                            : 'bg-slate-600'
                        }`}
                        style={{ width: `${Math.min(item.contribution_percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed Item Attribution Inspector */}
          <div className="lg:col-span-5">
            <div className="bg-[#FAF6F0] border border-[#D9C6B7] rounded-xl p-4 sticky top-4 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-[#5A4D3B] flex items-center justify-between">
                <span>Grounding Inspector</span>
                {selectedItem && (
                  <span className="font-mono text-teal-400 font-normal">
                    Weight: {selectedItem.contribution_weight.toFixed(3)}
                  </span>
                )}
              </div>

              {selectedItem ? (
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-[10px] text-[#6E5D4F] uppercase font-mono block">Evidence Excerpt</span>
                    <p className="p-3 rounded-lg bg-white border border-[#D9C6B7] text-[#3B2A1C] mt-1 leading-relaxed">
                      {selectedItem.excerpt}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#6E5D4F] uppercase font-mono block">Provenance Trace</span>
                    <div className="p-2.5 rounded-lg bg-white border border-[#D9C6B7] text-[#5A4D3B] font-mono text-[11px] mt-1">
                      {selectedItem.source_provenance}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#6E5D4F] uppercase font-mono block">
                      Synthesis Grounding Matches ({selectedItem.synthesis_attribution_segments.length})
                    </span>
                    {selectedItem.synthesis_attribution_segments.length > 0 ? (
                      <div className="space-y-1.5 mt-1.5">
                        {selectedItem.synthesis_attribution_segments.map((seg, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded bg-teal-950/20 border border-teal-800/40 text-teal-200 text-[11px] leading-relaxed flex items-start gap-2"
                          >
                            <ArrowRight className="w-3 h-3 text-teal-400 shrink-0 mt-0.5" />
                            <span>"{seg}"</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[#6E5D4F] italic mt-1">
                        Broader semantic support without direct clause citation.
                      </p>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-[#D9C6B7] text-[11px] text-[#6E5D4F] space-y-1">
                    <div className="font-semibold text-[#5A4D3B] flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-teal-400" />
                      Attribution Semantics
                    </div>
                    <p>
                      This item represents {selectedItem.contribution_percentage}% of total textual grounding in the
                      report synthesis. High sensitivity indicates significant linguistic presence, not direct causal etiology.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-[#6E5D4F] text-xs italic py-8 text-center">
                  Select an evidence item from the list to view its grounding trace.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
