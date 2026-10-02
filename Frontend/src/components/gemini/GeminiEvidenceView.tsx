import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/apiClient';
import type {
  GeminiStatusResponse,
  GeminiSynthesisResult,
} from '../../types/api';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  FileText,
  KeyRound,
  RefreshCw,
  HelpCircle,
  Layers,
  CheckCircle2,
  GitCompare,
  FileCheck,
} from 'lucide-react';

interface GeminiEvidenceViewProps {
  caseId: string;
  patientId?: string;
}

export const GeminiEvidenceView: React.FC<GeminiEvidenceViewProps> = ({
  caseId,
  patientId,
}) => {
  const [statusInfo, setStatusInfo] = useState<GeminiStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [selectedAction, setSelectedAction] = useState<string>('evidence_grounded_synthesis');
  const [synthesisResult, setSynthesisResult] = useState<GeminiSynthesisResult | null>(null);
  const [synthesizing, setSynthesizing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Gemini service status
  const checkStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await apiClient.getGeminiStatus();
      setStatusInfo(res);
    } catch (err: unknown) {
      setStatusInfo({
        status: 'ERROR',
        model: 'unknown',
        message: err instanceof Error ? err.message : 'Failed to query Gemini service status',
        supported_actions: [],
      });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Execute synthesis for current case
  const handleSynthesize = async () => {
    if (!caseId) return;
    setSynthesizing(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.synthesizeCaseEvidence(caseId, selectedAction);
      setSynthesisResult(res);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gemini synthesis failed');
    } finally {
      setSynthesizing(false);
    }
  };

  const actionLabels: Record<string, { label: string; desc: string }> = {
    evidence_grounded_synthesis: {
      label: 'Evidence-Grounded Synthesis',
      desc: 'Correlate specialized model findings with patient history without extrapolation',
    },
    screening_report_draft: {
      label: 'Screening Report Draft',
      desc: 'Draft comprehensive clinical review report with executive findings and questions',
    },
    clinical_history_summary: {
      label: 'Clinical History Summary',
      desc: 'Synthesize longitudinal history bounded strictly by retrieved patient records',
    },
    bounded_evidence_comparison: {
      label: 'Bounded Evidence Comparison',
      desc: 'Compare current model findings against baseline historical evidence',
    },
    document_extraction: {
      label: 'Document Extraction',
      desc: 'Extract key clinical facts, diagnoses, and lab values from intake documents',
    },
  };

  return (
    <div className="space-y-6">
      {/* STATUS BANNER & GEMINI HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-[#D9C6B7] bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white tracking-tight">Gemini Evidence-Language Layer</h2>
                <Badge className="bg-indigo-950/90 text-indigo-300 border border-indigo-700/80 font-mono text-[10px]">
                  PHASE 10
                </Badge>
              </div>
              <p className="text-xs text-[#6E5D4F] mt-0.5">
                Evidence synthesis, bounded comparison, and report drafting grounded in multimodal findings & RAG records.
              </p>
            </div>
          </div>

          {/* Status Badge Display */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {loadingStatus ? (
              <Badge variant="outline" className="text-xs text-[#6E5D4F] border-[#D9C6B7] flex items-center gap-1.5 py-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Checking API status...
              </Badge>
            ) : statusInfo?.status === 'READY' ? (
              <Badge className="bg-emerald-950/80 text-emerald-300 border border-emerald-700 flex items-center gap-1.5 text-xs py-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Gemini Ready ({statusInfo.model})
              </Badge>
            ) : statusInfo?.status === 'API_KEY_REQUIRED' ? (
              <Badge className="bg-amber-950/90 text-amber-300 border border-amber-600 font-bold flex items-center gap-1.5 text-xs py-1">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                API_KEY_REQUIRED
              </Badge>
            ) : (
              <Badge className="bg-rose-950/90 text-rose-300 border border-rose-600 font-bold flex items-center gap-1.5 text-xs py-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                ERROR
              </Badge>
            )}

            <Badge className="bg-[#FAF6F0] text-[#5A4D3B] border border-[#D9C6B7] text-xs py-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#8B6F5B]" />
              Anti-Hallucination Bounds Enforced
            </Badge>

            {patientId && (
              <Badge className="bg-[#F2E4D5]/70 text-[#8B6F5B] border border-[#D9C6B7] text-xs py-1 font-mono">
                Patient: {patientId.slice(0, 8)}...
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={checkStatus}
            disabled={loadingStatus}
            className="border-[#D9C6B7] hover:bg-[#FAF6F0] text-[#5A4D3B] text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
            Check Key
          </Button>
          <Button
            size="sm"
            onClick={handleSynthesize}
            disabled={synthesizing || statusInfo?.status !== 'READY'}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
          >
            {synthesizing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Synthesizing...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate Synthesis
              </>
            )}
          </Button>
        </div>
      </div>

      {/* API_KEY_REQUIRED ALERT */}
      {statusInfo?.status === 'API_KEY_REQUIRED' && (
        <Card className="border-amber-700/80 bg-amber-950/30 shadow-lg">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-amber-900/40 border border-amber-600 text-amber-300 shrink-0">
              <KeyRound className="w-5 h-5 text-amber-400" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-600 text-black font-mono font-bold text-xs uppercase">
                  API_KEY_REQUIRED
                </Badge>
                <h4 className="text-sm font-semibold text-white">Google Gemini API Key Missing</h4>
              </div>
              <p className="text-xs text-[#5A4D3B] leading-relaxed">
                The evidence-language layer requires a Google AI API Key configured server-side.
                Obtain a key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[#8B6F5B] underline hover:text-[#8B6F5B]">Google AI Studio</a> and save it in <code className="px-1.5 py-0.5 rounded bg-white border border-[#D9C6B7] text-amber-200">backend/.env</code>:
              </p>
              <pre className="p-2.5 rounded bg-[#FAF6F0] border border-[#D9C6B7] text-[11px] font-mono text-[#8B6F5B]">
                GEMINI_API_KEY=AIzaSy...<br />
                GEMINI_MODEL=gemini-3.8-flash
              </pre>
              <p className="text-[11px] text-[#6E5D4F]">
                Security requirement: The API key must never be placed in frontend code.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ERROR ALERT */}
      {statusInfo?.status === 'ERROR' && (
        <Card className="border-rose-700/80 bg-rose-950/30 shadow-lg">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-rose-600 text-white font-mono font-bold text-xs">ERROR</Badge>
                <h4 className="text-xs font-semibold text-white">Service Error</h4>
              </div>
              <p className="text-xs text-rose-200 mt-1">{statusInfo.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SYNTHESIS ACTION CONTROLS */}
      <Card className="border-[#D9C6B7] bg-white shadow-lg">
        <CardHeader className="pb-3 border-b border-[#D9C6B7]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Select Evidence Synthesis Action
            </CardTitle>
            <span className="text-xs text-[#6E5D4F]">Structured JSON response validated with Pydantic</span>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Object.entries(actionLabels).map(([actionKey, info]) => {
              const isSelected = selectedAction === actionKey;
              return (
                <button
                  key={actionKey}
                  type="button"
                  onClick={() => setSelectedAction(actionKey)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-500/80 text-white ring-1 ring-indigo-500/40 shadow-sm'
                      : 'bg-[#FCF9F5] border-[#D9C6B7] text-[#6E5D4F] hover:border-[#D9C6B7] hover:text-[#3B2A1C]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{info.label}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <p className="text-[11px] text-[#6E5D4F] mt-1 line-clamp-2 leading-relaxed">
                    {info.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* SYNTHESIS RESULTS DISPLAY */}
      {errorMsg && (
        <Card className="border-rose-800 bg-rose-950/30 p-4">
          <div className="flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        </Card>
      )}

      {synthesisResult && (
        <div className="space-y-5">
          {/* Main Narrative Card */}
          <Card className="border-[#D9C6B7] bg-white shadow-xl overflow-hidden">
            <CardHeader className="border-b border-[#D9C6B7] bg-[#FAF6F0] pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-950 border border-indigo-700/80 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 py-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Generated by Gemini
                  </Badge>
                  <Badge className="bg-[#F2E4D5]/80 border border-[#D9C6B7]/80 text-[#8B6F5B] font-mono text-[11px] uppercase tracking-wide">
                    {synthesisResult.result_type}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-[#6E5D4F]">
                  <span>Model:</span>
                  <span className="font-mono text-[#5A4D3B]">{synthesisResult.model_used}</span>
                  <span>•</span>
                  <span>{new Date(synthesisResult.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              {/* Executive Summary if available */}
              {synthesisResult.summary && (
                <div className="p-3.5 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-xs">
                  <span className="font-semibold text-indigo-300 uppercase tracking-wider block mb-1">
                    Executive Summary:
                  </span>
                  <p className="text-[#3B2A1C] leading-relaxed font-sans">{synthesisResult.summary}</p>
                </div>
              )}

              {/* Primary Generated Synthesis Narrative */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6E5D4F] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  Grounded Synthesis Narrative:
                </h4>
                <div className="p-4 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] text-[#3B2A1C] text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {synthesisResult.generated_synthesis}
                </div>
              </div>

              {/* SUPPORTING EVIDENCE & EVIDENCE IDS */}
              <div className="space-y-2.5 pt-2 border-t border-[#D9C6B7]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#5A4D3B] flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-[#8B6F5B]" />
                    Supporting Evidence
                  </h4>
                  <span className="text-[11px] text-[#6E5D4F]">
                    {synthesisResult.supporting_evidence_ids.length} Provenance Evidence IDs Linked
                  </span>
                </div>

                {synthesisResult.supporting_evidence_ids.length === 0 ? (
                  <p className="text-xs text-[#6E5D4F] italic">No specific evidence IDs cited.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {synthesisResult.supporting_evidence_ids.map((id, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#FAF6F0] border border-[#D9C6B7] text-xs text-[#5A4D3B] font-mono shadow-sm"
                      >
                        <span className="text-[#8B6F5B] font-semibold">Evidence ID:</span>
                        <span className="truncate max-w-[200px]" title={id}>{id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* UNCERTAINTIES SECTION */}
              {synthesisResult.uncertainty_notes.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#D9C6B7]">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Uncertainty & Data Gaps
                  </h4>
                  <div className="space-y-1.5">
                    {synthesisResult.uncertainty_notes.map((note, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200/90 flex items-start gap-2"
                      >
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CONFLICTS SECTION */}
              {synthesisResult.conflicts.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-[#D9C6B7]">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <GitCompare className="w-3.5 h-3.5 text-rose-400" />
                    Conflicts & Historical Discrepancies
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {synthesisResult.conflicts.map((conflict, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-800/50 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between text-rose-300 font-semibold">
                          <span>{conflict.finding_or_claim}</span>
                          <Badge className="bg-rose-900/60 text-rose-200 border-rose-700 text-[10px]">
                            Discrepancy
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6E5D4F] bg-[#FCF9F5] p-2 rounded border border-rose-900/30">
                          <div>
                            <span className="text-[#6E5D4F] block">Source A:</span>
                            <span className="text-[#3B2A1C]">{conflict.source_a}</span>
                          </div>
                          <div>
                            <span className="text-[#6E5D4F] block">Source B:</span>
                            <span className="text-[#3B2A1C]">{conflict.source_b}</span>
                          </div>
                        </div>
                        <p className="text-[#5A4D3B] text-[11px] leading-relaxed">
                          {conflict.conflict_description}
                        </p>
                        {conflict.clinical_significance && (
                          <div className="text-[11px] text-amber-300/90 pt-1">
                            <span className="font-semibold text-amber-400">Significance: </span>
                            {conflict.clinical_significance}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUGGESTED REVIEW QUESTIONS */}
              {synthesisResult.suggested_review_questions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#D9C6B7]">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8B6F5B] flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-[#8B6F5B]" />
                    Suggested Clinician Review Questions
                  </h4>
                  <div className="space-y-1.5">
                    {synthesisResult.suggested_review_questions.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded bg-[#F2E4D5]/20 border border-[#D9C6B7] text-xs text-cyan-200/90 flex items-start gap-2"
                      >
                        <span className="text-[#8B6F5B] font-bold">{idx + 1}.</span>
                        <span>{q}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
