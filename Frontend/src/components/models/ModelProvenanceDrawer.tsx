import React from 'react';
import type { ModelProvenance } from '../../types/api';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  X,
  ShieldCheck,
  Cpu,
  FileCheck,
  Scale,
  Layers,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';

interface ModelProvenanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  provenance: ModelProvenance;
  limitations?: string[];
  runtimeMs?: number;
  runId?: string;
}

export const ModelProvenanceDrawer: React.FC<ModelProvenanceDrawerProps> = ({
  isOpen,
  onClose,
  provenance,
  limitations = [],
  runtimeMs,
  runId,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify({ run_id: runId, provenance, limitations }, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex justify-end transition-opacity duration-300">
      <div className="w-full max-w-2xl bg-white border-l border-[#D9C6B7] text-[#3B2A1C] h-full flex flex-col shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-[#D9C6B7] bg-white sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#F2E4D5] border border-[#D9C6B7] text-[#8B6F5B]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#3B2A1C] flex items-center gap-2">
                Clinical Model Provenance
                <Badge variant="outline" className="text-[#8B6F5B] border-[#D9C6B7] text-xs">
                  Verified Audit
                </Badge>
              </h3>
              <p className="text-xs text-[#6E5D4F]">
                Immutable cryptographic trace & model weights documentation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyJson}
              className="text-xs bg-[#FAF6F0] border-[#D9C6B7] hover:bg-[#FAF6F0] text-[#3B2A1C]"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Export JSON
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-1.5 text-[#6E5D4F] hover:text-[#3B2A1C] rounded-md hover:bg-[#FAF6F0]"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Section: Model Specifications */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6E5D4F] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#8B6F5B]" />
              Model Architecture & Training
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-[#FCF9F5] border border-[#D9C6B7] rounded-lg p-3">
                <span className="text-xs text-[#6E5D4F] block mb-1">Model Name</span>
                <span className="font-semibold text-[#3B2A1C]">{provenance.model_name}</span>
              </div>
              <div className="bg-[#FCF9F5] border border-[#D9C6B7] rounded-lg p-3">
                <span className="text-xs text-[#6E5D4F] block mb-1">Architecture</span>
                <span className="font-mono text-[#8B6F5B] text-xs">{provenance.architecture}</span>
              </div>
              <div className="bg-[#FCF9F5] border border-[#D9C6B7] rounded-lg p-3">
                <span className="text-xs text-[#6E5D4F] block mb-1">License</span>
                <span className="text-xs text-[#5A4D3B] flex items-center gap-1">
                  <Scale className="w-3 h-3 text-emerald-400" />
                  {provenance.license}
                </span>
              </div>
              <div className="bg-[#FCF9F5] border border-[#D9C6B7] rounded-lg p-3">
                <span className="text-xs text-[#6E5D4F] block mb-1">Citation</span>
                <span className="text-xs text-[#6E5D4F] italic block">{provenance.citation}</span>
              </div>
            </div>

            {/* Training Datasets */}
            <div className="bg-[#FCF9F5] border border-[#D9C6B7] rounded-lg p-3">
              <span className="text-xs text-[#6E5D4F] block mb-2">Composite Training Datasets</span>
              <div className="flex flex-wrap gap-1.5">
                {(provenance.training_datasets || []).map((ds) => (
                  <Badge key={ds} variant="outline" className="bg-white border-[#D9C6B7] text-[#5A4D3B] text-xs">
                    {ds}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Weight Verification & Cryptographic Integrity */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6E5D4F] flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              Weight Artifacts & Cryptography
            </h4>
            <div className="bg-[#FCF9F5] border border-[#D9C6B7] rounded-lg p-3.5 space-y-2 text-xs">
              <div>
                <span className="text-[#6E5D4F] block">Weights Release URL:</span>
                <span className="font-mono text-[#8B6F5B] break-all select-all text-[11px]">
                  {provenance.weights_source}
                </span>
              </div>
              {provenance.weights_hash && (
                <div>
                  <span className="text-[#6E5D4F] block">Model Weights SHA-256 Checksum:</span>
                  <span className="font-mono text-emerald-400 break-all select-all text-[11px] bg-white px-2 py-0.5 rounded border border-[#D9C6B7] block mt-0.5">
                    {provenance.weights_hash}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section: Input Image Preprocessing */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6E5D4F] flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-400" />
              Preprocessing & Hardware Execution
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#FCF9F5] border border-[#D9C6B7] rounded-lg p-3">
                <span className="text-[#6E5D4F] block mb-1">Input Dimensions</span>
                <span className="font-mono text-[#3B2A1C]">{provenance.input_dimensions}</span>
              </div>
              <div className="bg-[#FCF9F5] border border-[#D9C6B7] rounded-lg p-3">
                <span className="text-[#6E5D4F] block mb-1">Normalization Range</span>
                <span className="font-mono text-[#3B2A1C]">{provenance.normalization_range}</span>
              </div>
              <div className="bg-[#FCF9F5] border border-[#D9C6B7] rounded-lg p-3">
                <span className="text-[#6E5D4F] block mb-1">Frameworks</span>
                <span className="text-[#5A4D3B]">
                  PyTorch <span className="font-mono text-[#8B6F5B]">{provenance.torch_version}</span> | XRV{' '}
                  <span className="font-mono text-[#8B6F5B]">{provenance.torchxrayvision_version}</span>
                </span>
              </div>
              <div className="bg-[#FCF9F5] border border-[#D9C6B7] rounded-lg p-3">
                <span className="text-[#6E5D4F] block mb-1">Execution Hardware</span>
                <span className="font-semibold text-[#3B2A1C] uppercase flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-[#8B6F5B]" />
                  {provenance.device}
                  {runtimeMs !== undefined && (
                    <span className="text-[#6E5D4F] font-mono text-xs font-normal">
                      ({runtimeMs.toFixed(1)} ms)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Input Asset Checksum */}
            {(provenance.input_asset_filename || provenance.input_asset_sha256) && (
              <div className="bg-[#FCF9F5] border border-[#D9C6B7] rounded-lg p-3 text-xs">
                <span className="text-[#6E5D4F] block mb-1">Ingested Asset Validation</span>
                <div className="space-y-1">
                  {provenance.input_asset_filename && (
                    <div>
                      <span className="text-[#6E5D4F]">File: </span>
                      <span className="font-medium text-[#3B2A1C]">{provenance.input_asset_filename}</span>
                    </div>
                  )}
                  {provenance.input_asset_sha256 && (
                    <div>
                      <span className="text-[#6E5D4F]">Asset SHA-256: </span>
                      <span className="font-mono text-[#5A4D3B] text-[11px] break-all">
                        {provenance.input_asset_sha256}
                      </span>
                    </div>
                  )}
                  <div className="text-[11px] text-[#6E5D4F]">
                    Timestamp: {new Date(provenance.execution_timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: Clinical Limitations & Contraindications */}
          {limitations.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Documented Clinical Limitations & Contraindications
              </h4>
              <Card className="bg-amber-950/20 border border-amber-500/30 p-4 space-y-2">
                {limitations.map((lim, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-amber-200/90 leading-relaxed">
                    <span className="font-bold text-amber-400 mt-0.5">•</span>
                    <span>{lim}</span>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
