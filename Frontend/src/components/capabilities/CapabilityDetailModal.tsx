import React, { useState } from 'react';
import type { ClinicalCapability, CapabilityHealthInfo } from '../../types/api';
import { apiClient } from '../../services/apiClient';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Layers,
  AlertCircle,
  ExternalLink,
  BookOpen,
  Sliders,
} from 'lucide-react';

interface CapabilityDetailModalProps {
  capability: ClinicalCapability | null;
  onClose: () => void;
  onHealthUpdated?: (updatedCapability: ClinicalCapability) => void;
}

export const CapabilityDetailModal: React.FC<CapabilityDetailModalProps> = ({
  capability,
  onClose,
  onHealthUpdated,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [healthData, setHealthData] = useState<CapabilityHealthInfo | null>(null);

  if (!capability) return null;

  const currentVerification = healthData?.verification_details || capability.verification_details;
  const isReady = healthData ? healthData.runtime_ready : capability.status === 'ready';
  const checklist = currentVerification?.checklist || {};

  const handleRefreshHealth = async () => {
    setRefreshing(true);
    try {
      const data = await apiClient.getCapabilityHealth(capability.capability_id);
      setHealthData(data);
      if (onHealthUpdated) {
        onHealthUpdated({
          ...capability,
          status: data.runtime_ready ? 'ready' : 'not_configured',
          verification_details: data.verification_details,
        });
      }
    } catch (err) {
      console.error('Failed to refresh capability health:', err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3B2A1C]/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-[#D9C6B7] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-[#D9C6B7] flex items-start justify-between gap-4 bg-[#FCF9F5]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono uppercase bg-[#F2E4D5] border-[#D9C6B7] text-[#5A4D3B]">
                {capability.expected_modality}
              </Badge>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  isReady
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-900 border-amber-300'
                }`}
              >
                {isReady ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
                {isReady ? 'READY FOR INFERENCE' : 'NOT CONFIGURED'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#3B2A1C]">{capability.name}</h2>
            <p className="font-mono text-xs text-[#6E5D4F]">{capability.capability_id}</p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#FAF6F0] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-[#5A4D3B]">
          {/* Clinical Description */}
          <div className="p-4 rounded-xl bg-[#FCF9F5] border border-[#D9C6B7]">
            <h4 className="text-[11px] uppercase tracking-wider font-semibold text-[#6E5D4F] mb-1">
              Clinical Indication & Scope
            </h4>
            <p className="text-[#3B2A1C] text-xs leading-relaxed">{capability.description}</p>
          </div>

          {/* 9-Point Verification Audit Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#8B6F5B]" />
                9-Point Candidate Model Verification Audit
              </h4>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshHealth}
                disabled={refreshing}
                className="text-xs h-7 border-[#D9C6B7] bg-white hover:bg-[#FAF6F0] text-[#5A4D3B]"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? 'animate-spin text-[#8B6F5B]' : ''}`} />
                {refreshing ? 'Verifying...' : 'Re-verify Audit'}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(checklist).map(([criterion, item]) => {
                const verified = item.verified;
                return (
                  <div
                    key={criterion}
                    className={`p-3 rounded-lg border ${
                      verified
                        ? 'bg-[#FAF6F0] border-emerald-500/20'
                        : 'bg-rose-950/20 border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-[#3B2A1C] capitalize">
                        {criterion.replace('_', ' ')}
                      </span>
                      {verified ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#6E5D4F] leading-snug line-clamp-2" title={item.details}>
                      {item.details}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Failure Reasons Notice if Not Configured */}
            {!isReady && currentVerification?.failure_reasons && currentVerification.failure_reasons.length > 0 && (
              <div className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-500/30 flex items-start gap-2.5 text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div className="space-y-1">
                  <strong className="font-semibold">Verification Hold Notice:</strong>
                  <ul className="list-disc list-inside text-[11px] text-amber-200/90 space-y-0.5">
                    {currentVerification.failure_reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-amber-400 font-mono pt-1">
                    STATUS = NOT_CONFIGURED. Strict policy: Simulated/fake predictions are not executed.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Preprocessing & Output Contracts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Preprocessing Contract */}
            <div className="p-4 rounded-xl bg-[#FCF9F5] border border-[#D9C6B7] space-y-2">
              <h4 className="text-xs font-semibold text-[#3B2A1C] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#8B6F5B]" />
                Preprocessing Contract
              </h4>
              <div className="space-y-1.5 font-mono text-[11px]">
                {Object.entries(capability.preprocessing_contract).map(([key, val]) => (
                  <div key={key} className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-[#6E5D4F]">{key}:</span>
                    <span className="text-[#5A4D3B] text-right max-w-[65%] truncate" title={String(val)}>
                      {Array.isArray(val) ? val.join(', ') : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Output Schema */}
            <div className="p-4 rounded-xl bg-[#FCF9F5] border border-[#D9C6B7] space-y-2">
              <h4 className="text-xs font-semibold text-[#3B2A1C] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Output Schema
              </h4>
              <div className="space-y-1.5 font-mono text-[11px]">
                {Object.entries(capability.output_schema).map(([key, val]) => (
                  <div key={key} className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-[#6E5D4F]">{key}:</span>
                    <span className="text-[#5A4D3B] text-right max-w-[65%] truncate" title={String(val)}>
                      {Array.isArray(val) ? val.join(', ') : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Model Source, Provenance & License */}
          <div className="p-4 rounded-xl bg-[#FCF9F5] border border-[#D9C6B7] space-y-3">
            <h4 className="text-xs font-semibold text-[#3B2A1C] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              Model Source, Provenance & Clinical License
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-[#6E5D4F] block">Candidate Model Source</span>
                <a
                  href={capability.model_source}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#8B6F5B] hover:underline flex items-center gap-1 mt-0.5 break-all"
                >
                  {capability.model_source}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
              <div>
                <span className="text-[#6E5D4F] block">License Designation</span>
                <span className="text-[#5A4D3B] font-medium mt-0.5 block">{capability.license}</span>
              </div>
              <div className="md:col-span-2">
                <span className="text-[#6E5D4F] block">Citation & Training Cohorts</span>
                <p className="text-[#5A4D3B] italic mt-0.5">
                  {String(capability.provenance.citation || 'Author citation documented')}
                </p>
              </div>
            </div>
          </div>

          {/* Limitations & Contraindications */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              Clinical Limitations & Contraindications ({capability.limitations.length})
            </h4>
            <div className="space-y-1.5">
              {capability.limitations.map((lim, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7]/80 text-[11px] text-[#5A4D3B]">
                  <span className="text-rose-400 font-semibold mr-1.5">•</span>
                  {lim}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#D9C6B7] flex items-center justify-between bg-[#FAF6F0]">
          <span className="font-mono text-[11px] text-[#6E5D4F]">
            Adapter: {capability.adapter_class}
          </span>
          <Button variant="outline" onClick={onClose} className="text-xs border-[#D9C6B7] bg-[#FAF6F0] hover:bg-[#FAF6F0]">
            Close Specification
          </Button>
        </div>
      </div>
    </div>
  );
};
