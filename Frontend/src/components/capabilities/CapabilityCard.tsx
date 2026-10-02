import React from 'react';
import type { ClinicalCapability } from '../../types/api';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Brain,
  Scan,
  Activity,
  Layers,
  CheckCircle2,
  AlertCircle,
  Shield,
  Cpu,
  ArrowRight,
} from 'lucide-react';

interface CapabilityCardProps {
  capability: ClinicalCapability;
  onSelect: (capability: ClinicalCapability) => void;
}

export const CapabilityCard: React.FC<CapabilityCardProps> = ({ capability, onSelect }) => {
  const isReady = capability.status === 'ready';

  const getModalityIcon = (modality: string) => {
    switch (modality.toLowerCase()) {
      case 'chest_xray':
        return <Scan className="w-4 h-4 text-[#8B6F5B]" />;
      case 'mri':
        return <Brain className="w-4 h-4 text-indigo-400" />;
      case 'ct':
        return <Scan className="w-4 h-4 text-blue-400" />;
      case 'ecg':
        return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'skin_image':
        return <Layers className="w-4 h-4 text-amber-400" />;
      default:
        return <Layers className="w-4 h-4 text-[#6E5D4F]" />;
    }
  };

  const getModalityLabel = (modality: string) => {
    switch (modality.toLowerCase()) {
      case 'chest_xray':
        return 'Chest X-Ray';
      case 'mri':
        return 'Brain MRI';
      case 'ct':
        return 'Head CT';
      case 'ecg':
        return '12-Lead ECG';
      case 'skin_image':
        return 'Dermoscopy / Skin';
      default:
        return modality.toUpperCase();
    }
  };

  const getModelAvailabilityText = () => {
    if (capability.status === 'ready') {
      return {
        label: 'Model Verified & Available',
        badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        detail: 'TorchXRayVision DenseNet-121 checkpoint active on local disk',
      };
    }
    return {
      label: 'Model Not Configured',
      badgeClass: 'bg-[#FAF6F0] text-amber-400 border-amber-500/20',
      detail: 'Weights checkpoint or runtime dependencies unconfigured',
    };
  };

  const modelAvail = getModelAvailabilityText();

  return (
    <Card className="p-5 bg-white border-[#D9C6B7] hover:border-[#8B6F5B] transition-all flex flex-col justify-between shadow-sm relative group overflow-hidden">
      {/* Top accent glow */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          isReady ? 'bg-[#8B6F5B]' : 'bg-slate-700'
        }`}
      />

      <div className="space-y-4">
        {/* Header: Modality + Status Pill */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7]">
              {getModalityIcon(capability.expected_modality)}
            </span>
            <Badge variant="outline" className="text-xs bg-[#FAF6F0] border-[#D9C6B7] font-medium text-[#5A4D3B]">
              {getModalityLabel(capability.expected_modality)}
            </Badge>
          </div>

          {/* Capability Status */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isReady
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm'
                : 'bg-amber-50 text-amber-900 border-amber-300'
            }`}
          >
            {isReady ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
            {isReady ? 'READY' : 'NOT CONFIGURED'}
          </span>
        </div>

        {/* Title & Slug */}
        <div>
          <h3 className="text-base font-bold text-[#3B2A1C] group-hover:text-[#8B6F5B] transition-colors">
            {capability.name}
          </h3>
          <p className="font-mono text-[11px] text-[#6E5D4F] mt-0.5">{capability.capability_id}</p>
        </div>

        {/* Clinical Description */}
        <p className="text-xs text-[#6E5D4F] line-clamp-2 leading-relaxed">
          {capability.description}
        </p>

        {/* Model Availability Strip */}
        <div className="p-2.5 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7]/80 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#6E5D4F] font-medium flex items-center gap-1">
              <Cpu className="w-3 h-3 text-[#6E5D4F]" />
              Model Availability
            </span>
            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${modelAvail.badgeClass}`}>
              {modelAvail.label}
            </Badge>
          </div>
          <p className="text-[11px] text-[#6E5D4F] truncate">{modelAvail.detail}</p>
        </div>

        {/* Technical Specs Tags */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6E5D4F]">
          <div className="p-2 rounded bg-[#FCF9F5] border border-[#D9C6B7]">
            <span className="text-[10px] uppercase tracking-wider text-[#6E5D4F] block">Adapter Class</span>
            <span className="font-mono text-[#5A4D3B] truncate block mt-0.5" title={capability.adapter_class}>
              {capability.adapter_class}
            </span>
          </div>
          <div className="p-2 rounded bg-[#FCF9F5] border border-[#D9C6B7]">
            <span className="text-[10px] uppercase tracking-wider text-[#6E5D4F] block">License</span>
            <span className="text-[#5A4D3B] truncate block mt-0.5" title={capability.license}>
              {capability.license.split('(')[0].trim()}
            </span>
          </div>
        </div>
      </div>

      {/* Footer / CTA Button */}
      <div className="mt-5 pt-4 border-t border-[#D9C6B7] flex items-center justify-between gap-3">
        <span className="text-[11px] text-[#6E5D4F] flex items-center gap-1">
          <Shield className="w-3 h-3 text-[#8B6F5B]" />
          9-Point Clinical Verification
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSelect(capability)}
          className="text-xs border-[#D9C6B7] bg-white hover:bg-[#FAF6F0] text-[#5A4D3B] hover:text-[#3B2A1C] shadow-sm"
        >
          Inspect Architecture
          <ArrowRight className="w-3 h-3 ml-1 text-[#8B6F5B]" />
        </Button>
      </div>
    </Card>
  );
};
