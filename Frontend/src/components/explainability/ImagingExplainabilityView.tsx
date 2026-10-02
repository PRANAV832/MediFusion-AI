import React, { useState, useEffect } from 'react';
import {
  Eye,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Image as ImageIcon,
} from 'lucide-react';
import { api } from '../../services/apiClient';
import type { ImagingExplainabilityResult } from '../../types/api';

interface ImagingExplainabilityViewProps {
  assetId: string;
  caseId?: string;
  initialPathology?: string;
}

const COMMON_PATHOLOGIES = [
  'Pneumonia',
  'Consolidation',
  'Infiltration',
  'Effusion',
  'Atelectasis',
  'Pneumothorax',
  'Cardiomegaly',
  'Lung Opacity',
];

export const ImagingExplainabilityView: React.FC<ImagingExplainabilityViewProps> = ({
  assetId,
  caseId,
  initialPathology = 'Pneumonia',
}) => {
  const [result, setResult] = useState<ImagingExplainabilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetPathology, setTargetPathology] = useState<string>(initialPathology);
  const [viewMode, setViewMode] = useState<'OVERLAY' | 'HEATMAP'>('OVERLAY');

  const fetchExplainability = async (pathology: string) => {
    if (!assetId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.generateImagingExplainability(assetId, pathology, caseId);
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate imaging explainability');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExplainability(targetPathology);
  }, [assetId, targetPathology]);

  return (
    <div className="bg-white border border-[#D9C6B7] rounded-xl p-6 text-[#3B2A1C] shadow-xl space-y-6">
      {/* Prominent Label as strictly required */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#D9C6B7]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-[#8B6F5B]/20 text-[#8B6F5B]">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#3B2A1C] tracking-wide uppercase font-mono">
                MODEL-SPECIFIC EXPLAINABILITY
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-cyan-500/20 text-[#8B6F5B] border border-[#8B6F5B]/30">
                PyTorch Grad-CAM
              </span>
            </div>
            <p className="text-xs text-[#6E5D4F] mt-0.5">
              Direct gradient backpropagation through convolutional layer <code className="text-[#8B6F5B]">features.denseblock4</code>. Zero decorative heatmaps.
            </p>
          </div>
        </div>

        {/* Pathology Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6E5D4F] font-mono">Target Pathology:</span>
          <select
            value={targetPathology}
            onChange={(e) => setTargetPathology(e.target.value)}
            disabled={loading}
            className="text-xs bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#8B6F5B] font-mono"
          >
            {COMMON_PATHOLOGIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchExplainability(targetPathology)}
            disabled={loading}
            className="p-1.5 rounded-lg bg-[#FAF6F0] hover:bg-[#FAF6F0] text-[#5A4D3B] border border-[#D9C6B7] transition"
            title="Recompute Grad-CAM"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Case 1: Model-specific explainability unavailable (strictly NO decorative heatmaps) */}
      {result && !result.is_available && (
        <div className="p-5 rounded-xl bg-[#FAF6F0] border border-amber-900/40 text-amber-200 space-y-3">
          <div className="flex items-center gap-2.5 font-bold text-amber-300 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span>EXPLAINABILITY UNAVAILABLE — DECORATIVE VISUALIZATIONS PROHIBITED</span>
          </div>
          <p className="text-xs text-[#5A4D3B] leading-relaxed">
            {result.unavailability_reason}
          </p>
          <div className="p-3 rounded-lg bg-white border border-[#D9C6B7] text-[11px] text-[#6E5D4F] font-mono">
            Safety Policy: MediFusion strictly forbids synthetic Gaussian blobs, random colored overlays, or simulated heatmaps. Explainability is only rendered when backed by authenticated model weights and gradient computations.
          </div>
        </div>
      )}

      {/* Case 2: Authentic Grad-CAM Available */}
      {result && result.is_available && (
        <div className="space-y-6">
          {/* Authenticity Declaration Banner */}
          <div className="p-3.5 rounded-xl bg-[#F2E4D5]/20 border border-[#D9C6B7] text-cyan-200 text-xs flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#8B6F5B] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[#8B6F5B] uppercase tracking-wide">
                MODEL-SPECIFIC EXPLAINABILITY VERIFIED
              </div>
              <p className="text-cyan-200/90 mt-0.5">{result.authenticity_statement}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Radiograph & Activation Map Display */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6E5D4F] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#6E5D4F]" />
                  Radiograph Activation Canvas
                </span>

                <div className="flex items-center bg-[#FAF6F0] p-0.5 rounded-lg border border-[#D9C6B7] text-xs">
                  <button
                    onClick={() => setViewMode('OVERLAY')}
                    className={`px-3 py-1 rounded font-medium transition ${
                      viewMode === 'OVERLAY'
                        ? 'bg-[#8B6F5B] text-white shadow'
                        : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
                    }`}
                  >
                    Blended Overlay
                  </button>
                  <button
                    onClick={() => setViewMode('HEATMAP')}
                    className={`px-3 py-1 rounded font-medium transition ${
                      viewMode === 'HEATMAP'
                        ? 'bg-[#8B6F5B] text-white shadow'
                        : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
                    }`}
                  >
                    Raw Heatmap
                  </button>
                </div>
              </div>

              <div className="relative aspect-square max-w-md mx-auto rounded-xl overflow-hidden bg-black border border-[#D9C6B7] flex items-center justify-center shadow-2xl">
                {viewMode === 'OVERLAY' && result.overlay_png_base64 && (
                  <img
                    src={result.overlay_png_base64}
                    alt={`Grad-CAM overlay for ${result.target_pathology}`}
                    className="w-full h-full object-contain"
                  />
                )}
                {viewMode === 'HEATMAP' && result.heatmap_png_base64 && (
                  <img
                    src={result.heatmap_png_base64}
                    alt={`Grad-CAM heatmap for ${result.target_pathology}`}
                    className="w-full h-full object-contain"
                  />
                )}

                {/* Overlaid crosshair on peak coordinates */}
                {result.peak_activation_coords && (
                  <div
                    className="absolute w-4 h-4 pointer-events-none -translate-x-1/2 -translate-y-1/2 border border-cyan-400 rounded-full animate-ping"
                    style={{
                      left: `${(result.peak_activation_coords[0] / 224) * 100}%`,
                      top: `${(result.peak_activation_coords[1] / 224) * 100}%`,
                    }}
                  />
                )}
              </div>

              <div className="text-center text-[11px] text-[#6E5D4F] font-mono">
                Resolution: 224 × 224 px • Bilinear Upsampled from 7 × 7 feature map
              </div>
            </div>

            {/* Right: Technical Explainability Metadata */}
            <div className="lg:col-span-5 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-[#6E5D4F]">
                Grad-CAM Technical Telemetry
              </div>

              <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#D9C6B7] space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                  <span className="text-[#6E5D4F]">Target Pathology</span>
                  <span className="font-bold text-[#8B6F5B] text-sm">{result.target_pathology}</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                  <span className="text-[#6E5D4F]">Calibrated Probability</span>
                  <span className="font-mono font-bold text-[#3B2A1C]">
                    {result.calibrated_probability !== undefined && result.calibrated_probability !== null
                      ? `${(result.calibrated_probability * 100).toFixed(1)}%`
                      : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                  <span className="text-[#6E5D4F]">Target Layer</span>
                  <span className="font-mono text-[#8B6F5B] bg-[#F2E4D5] px-2 py-0.5 rounded border border-[#D9C6B7]">
                    {result.target_layer || 'features.denseblock4'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                  <span className="text-[#6E5D4F]">Peak Gradient Coords</span>
                  <span className="font-mono text-[#3B2A1C]">
                    {result.peak_activation_coords
                      ? `(${result.peak_activation_coords[0]}, ${result.peak_activation_coords[1]})`
                      : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                  <span className="text-[#6E5D4F]">Activation Coverage</span>
                  <span className="font-mono text-[#3B2A1C]">
                    {result.activation_coverage_pct !== undefined && result.activation_coverage_pct !== null
                      ? `${result.activation_coverage_pct.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#6E5D4F]">Methodology</span>
                  <span className="font-mono text-[#5A4D3B] text-[11px]">{result.method}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] text-[11px] text-[#6E5D4F] space-y-1.5">
                <div className="font-semibold text-[#5A4D3B] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#8B6F5B]" />
                  Interpretation Protocol
                </div>
                <p className="leading-relaxed">
                  The visual heatmap isolates regions where convolutional filter activation contributed most positively
                  to the target classification score. Warmer colors indicate higher gradient-weighted influence.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
