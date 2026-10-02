import React from 'react';
import type { DimensionMetrics } from '../../types/api';
import {
  Brain,
  GitCompare,
  History,
  FileCheck,
  Camera,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { Card } from '../ui/card';

interface DimensionGaugesProps {
  dimensions: DimensionMetrics;
}

interface GaugeItemProps {
  title: string;
  value: number | null | undefined;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  colorClass: string;
  emptyLabel?: string;
}

const GaugeItem: React.FC<GaugeItemProps> = ({
  title,
  value,
  icon: Icon,
  description,
  colorClass,
  emptyLabel = 'N/A',
}) => {
  const hasValue = value !== undefined && value !== null;
  const pct = hasValue ? Math.round(value * 100) : 0;

  return (
    <div className="p-3.5 rounded-xl bg-white border border-[#D9C6B7] space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#5A4D3B] flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
          {title}
        </span>
        <span className="font-mono text-xs font-bold text-[#3B2A1C]">
          {hasValue ? `${pct}%` : <span className="text-[#6E5D4F] font-normal italic">{emptyLabel}</span>}
        </span>
      </div>

      {/* Progress Track */}
      <div className="w-full h-2 rounded-full bg-[#FAF6F0] overflow-hidden">
        {hasValue ? (
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct >= 75
                ? 'bg-emerald-500'
                : pct >= 50
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
          />
        ) : (
          <div className="w-full h-full bg-[#FAF6F0]/40" />
        )}
      </div>

      <p className="text-[10px] text-[#6E5D4F] leading-tight">
        {description}
      </p>
    </div>
  );
};

export const DimensionGauges: React.FC<DimensionGaugesProps> = ({ dimensions }) => {
  return (
    <Card className="p-4 bg-white border-[#D9C6B7] space-y-3 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D9C6B7] pb-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#8B6F5B]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#3B2A1C]">
            Independent Evidentiary Dimensions
          </h3>
        </div>
        <span className="text-[11px] text-[#6E5D4F] font-mono">
          Anti-Conflation Guarantee Active
        </span>
      </div>

      {/* 5 Strictly Separated Dimensions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        <GaugeItem
          title="Model Confidence"
          value={dimensions.model_confidence}
          icon={Brain}
          colorClass="text-[#8B6F5B]"
          description="Average probability of genuine specialized neural findings. Never synthesized."
          emptyLabel="No Model Run"
        />

        <GaugeItem
          title="Cross-Model Agreement"
          value={dimensions.cross_model_agreement}
          icon={GitCompare}
          colorClass="text-indigo-400"
          description="Concordance ratio between multiple independent screening models on the same case."
          emptyLabel="Single Model"
        />

        <GaugeItem
          title="Historical Support"
          value={dimensions.historical_support}
          icon={History}
          colorClass="text-emerald-400"
          description="Proportion of acute findings that correlate with patient baseline records."
          emptyLabel="No Baseline"
        />

        <GaugeItem
          title="Evidence Completeness"
          value={dimensions.evidence_completeness}
          icon={FileCheck}
          colorClass="text-purple-400"
          description="Coverage of required triage parameters, clinical notes, and modality assets."
        />

        <GaugeItem
          title="Input Quality"
          value={dimensions.input_quality}
          icon={Camera}
          colorClass="text-amber-400"
          description="Technical validity, pixel resolution, and integrity of uploaded diagnostic assets."
        />
      </div>

      {/* Critical Rule Note */}
      <div className="p-2.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] text-[11px] text-[#6E5D4F] flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-[#8B6F5B] shrink-0 mt-0.5" />
        <span>
          <strong>Architectural Constraint:</strong> These five metrics measure independent axes of clinical validity. MediFusion AI strictly refuses to blend these dimensions into a single misleading score like <em className="text-[#5A4D3B]">"Diagnosis Confidence = 94%"</em>.
        </span>
      </div>
    </Card>
  );
};
