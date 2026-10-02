import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  Layers,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Scale,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/apiClient';
import type { ModelCouncilResult } from '../../types/api';

interface ModelCouncilViewProps {
  caseId: string;
  assetId?: string;
  onDeliberationComplete?: (result: ModelCouncilResult) => void;
}

export const ModelCouncilView: React.FC<ModelCouncilViewProps> = ({
  caseId,
  assetId,
  onDeliberationComplete,
}) => {
  const [councilResult, setCouncilResult] = useState<ModelCouncilResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAssetId, setActiveAssetId] = useState<string>(assetId || '');
  const [forceDeliberate, setForceDeliberate] = useState(false);

  const fetchCouncil = async (forced = false) => {
    if (!caseId || !activeAssetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.deliberateCouncil(caseId, activeAssetId, forced);
      setCouncilResult(res);
      onDeliberationComplete?.(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to deliberate model council');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (assetId) {
      setActiveAssetId(assetId);
    }
  }, [assetId]);

  useEffect(() => {
    if (activeAssetId) {
      fetchCouncil(forceDeliberate);
    }
  }, [caseId, activeAssetId]);

  return (
    <div className="bg-white border border-[#D9C6B7] rounded-xl p-6 text-[#3B2A1C] shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#D9C6B7]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#3B2A1C] tracking-wide">
                MODEL COUNCIL DELIBERATION
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Specialized Ensemble
              </span>
            </div>
            <p className="text-xs text-[#6E5D4F] mt-0.5">
              Multi-model peer review for ambiguous cases. Evaluates specialized compatible models without result fabrication.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[#5A4D3B] cursor-pointer">
            <input
              type="checkbox"
              checked={forceDeliberate}
              onChange={(e) => {
                setForceDeliberate(e.target.checked);
                fetchCouncil(e.target.checked);
              }}
              className="rounded border-[#D9C6B7] bg-[#FAF6F0] text-indigo-500 focus:ring-indigo-500"
            />
            <span>Force Ambiguous Deliberation</span>
          </label>

          <button
            onClick={() => fetchCouncil(forceDeliberate)}
            disabled={loading || !activeAssetId}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition shadow"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Deliberating...' : 'Run Council'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Case Ambiguity Status Banner */}
      {councilResult && (
        <div
          className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
            councilResult.is_ambiguous
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {councilResult.is_ambiguous ? (
              <Scale className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-sm font-semibold flex items-center gap-2">
                {councilResult.is_ambiguous ? (
                  <span>AMBIGUOUS CLINICAL CASE — COUNCIL INDICATED</span>
                ) : (
                  <span>UNAMBIGUOUS CASE — DEFINITIVE MARGINS</span>
                )}
                <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-white border border-current">
                  {councilResult.consensus_status}
                </span>
              </div>
              <p className="text-xs opacity-90 mt-1">{councilResult.ambiguity_rationale}</p>
            </div>
          </div>

          <div className="text-xs font-mono bg-white/70 px-3 py-2 rounded-lg border border-[#D9C6B7] shrink-0 space-y-1">
            <div className="text-[#6E5D4F]">
              Evaluated Models: <strong className="text-[#3B2A1C]">{councilResult.evaluated_models_count}</strong>
            </div>
            <div className="text-[#6E5D4F]">
              Missing Models: <strong className="text-amber-400">{councilResult.missing_models_count}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Council Verdict */}
      {councilResult?.council_verdict && (
        <div className="p-4 rounded-lg bg-white border border-[#D9C6B7] flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#5A4D3B] uppercase tracking-wider">
              Council Consensus & Verdict
            </div>
            <div className="text-sm text-[#3B2A1C] font-medium">
              {councilResult.council_verdict}
            </div>
          </div>
        </div>
      )}

      {/* Individual Specialized Models (Evaluated vs Missing) */}
      {councilResult && (
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[#6E5D4F] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#6E5D4F]" />
            Individual Model Evaluations ({councilResult.model_evaluations.length})
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {councilResult.model_evaluations.map((model, idx) => (
              <div
                key={model.model_id + idx}
                className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                  model.is_missing
                    ? 'bg-[#FAF6F0] border-[#D9C6B7] text-[#6E5D4F]'
                    : 'bg-[#FAF6F0] border-[#D9C6B7] text-[#3B2A1C] shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2">
                        {model.model_name}
                      </div>
                      <div className="text-xs text-[#6E5D4F] font-mono mt-0.5">
                        {model.capability} • {model.version}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded border uppercase ${
                        model.is_missing
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      }`}
                    >
                      {model.status}
                    </span>
                  </div>

                  {model.is_missing ? (
                    <div className="mt-3 p-3 rounded-lg bg-amber-950/20 border border-amber-900/40 text-xs text-amber-300/90 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5 text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Model Checkpoint Omitted
                      </div>
                      <p>{model.missing_reason}</p>
                      <div className="text-[11px] text-amber-400/70 italic mt-1">
                        * In accordance with safety protocol, missing model predictions are never synthesized.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2 rounded bg-white border border-[#D9C6B7]">
                        <span className="text-[#6E5D4F]">Primary Finding:</span>
                        <span className="font-semibold text-[#3B2A1C]">{model.finding_label}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded bg-white border border-[#D9C6B7]">
                          <div className="text-[10px] text-[#6E5D4F]">Probability</div>
                          <div className="text-sm font-mono font-bold text-indigo-400">
                            {model.probability !== undefined && model.probability !== null
                              ? `${(model.probability * 100).toFixed(1)}%`
                              : '—'}
                          </div>
                        </div>

                        <div className="p-2 rounded bg-white border border-[#D9C6B7]">
                          <div className="text-[10px] text-[#6E5D4F]">Threshold</div>
                          <div className="text-sm font-mono text-[#5A4D3B]">
                            {model.threshold !== undefined && model.threshold !== null
                              ? `${(model.threshold * 100).toFixed(0)}%`
                              : '—'}
                          </div>
                        </div>

                        <div className="p-2 rounded bg-white border border-[#D9C6B7]">
                          <div className="text-[10px] text-[#6E5D4F]">Decision</div>
                          <div
                            className={`text-sm font-bold flex items-center justify-center gap-1 ${
                              model.detected ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {model.detected ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" /> POS
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5" /> NEG
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#6E5D4F] pt-1">
                        <span>Device: {model.device || 'CPU'}</span>
                        <span>Latency: {model.runtime_ms ? `${model.runtime_ms}ms` : '—'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agreements Matrix */}
      {councilResult && councilResult.agreements.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Consensus Agreements ({councilResult.agreements.length})
          </div>

          <div className="space-y-2">
            {councilResult.agreements.map((agr, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-xs text-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-emerald-300 flex items-center gap-2">
                    <span>{agr.finding_domain}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-700/50 uppercase">
                      {agr.concordance_type}
                    </span>
                  </div>
                  <p className="text-emerald-200/80 mt-1">{agr.description}</p>
                  <div className="text-[11px] text-emerald-400/60 mt-1">
                    Models: {agr.participating_models.join(' + ')}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-[10px] text-emerald-400 uppercase font-mono block">Delta</span>
                  <span className="text-sm font-mono font-bold text-emerald-300">
                    {(agr.confidence_delta * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disagreements Matrix */}
      {councilResult && councilResult.disagreements.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Evidentiary Disagreements ({councilResult.disagreements.length})
          </div>

          <div className="space-y-2">
            {councilResult.disagreements.map((dis, idx) => (
              <div
                key={idx}
                className="p-4 rounded-lg bg-rose-950/20 border border-rose-900/40 text-xs text-rose-200 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-300 text-sm">{dis.finding_domain}</span>
                  <span className="px-2 py-0.5 rounded bg-rose-900/60 border border-rose-700/50 uppercase font-mono text-[10px]">
                    {dis.divergence_type}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2 rounded bg-white border border-[#D9C6B7]">
                  <div className="border-r border-[#D9C6B7] pr-2">
                    <span className="text-[10px] text-[#6E5D4F] block font-semibold">{dis.model_a_id}</span>
                    <span className="text-[#3B2A1C]">{dis.model_a_finding}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6E5D4F] block font-semibold">{dis.model_b_id}</span>
                    <span className="text-[#3B2A1C]">{dis.model_b_finding}</span>
                  </div>
                </div>

                <p className="text-[#5A4D3B]">{dis.divergence_reason}</p>

                <div className="p-2 rounded bg-rose-900/30 border border-rose-800/40 text-[11px] text-rose-300 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>
                    <strong>Recommended Action:</strong> {dis.recommended_clinical_action}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
