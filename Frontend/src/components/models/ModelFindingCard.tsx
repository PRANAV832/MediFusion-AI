import React from 'react';
import type { ModelFinding } from '../../types/api';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { AlertCircle } from 'lucide-react';

interface ModelFindingCardProps {
  finding: ModelFinding;
  className?: string;
}

export const ModelFindingCard: React.FC<ModelFindingCardProps> = ({ finding, className = '' }) => {
  const percentage = Math.round(finding.probability * 1000) / 10;
  const thresholdPct = Math.round(finding.threshold * 1000) / 10;
  const ppv80Pct = finding.ppv80_threshold ? Math.round(finding.ppv80_threshold * 1000) / 10 : null;

  // Determine styling based on severity & detection
  const isHighSeverity = finding.severity === 'high' || (ppv80Pct !== null && percentage >= ppv80Pct);
  const isDetected = finding.detected;

  let borderColor = 'border-[#D9C6B7] bg-[#FAF6F0]';
  let barColor = 'bg-slate-600';
  let badge = (
    <Badge variant="outline" className="bg-[#FAF6F0] text-[#6E5D4F] border-[#D9C6B7] text-[10px]">
      Below Threshold
    </Badge>
  );

  if (isHighSeverity) {
    borderColor = 'border-rose-500/40 bg-rose-950/20 shadow-sm shadow-rose-950/40';
    barColor = 'bg-gradient-to-r from-amber-500 to-rose-500';
    badge = (
      <Badge variant="outline" className="bg-rose-950/80 text-rose-300 border-rose-500/60 text-[10px] font-semibold flex items-center gap-1">
        <AlertCircle className="w-3 h-3 text-rose-400" />
        High Probability (PPV ≥ 80%)
      </Badge>
    );
  } else if (isDetected) {
    borderColor = 'border-amber-500/40 bg-amber-950/20 shadow-sm shadow-amber-950/40';
    barColor = 'bg-amber-500';
    badge = (
      <Badge variant="outline" className="bg-amber-950/80 text-amber-300 border-amber-500/60 text-[10px] font-semibold flex items-center gap-1">
        <AlertCircle className="w-3 h-3 text-amber-400" />
        Flagged (Above Op Threshold)
      </Badge>
    );
  }

  return (
    <Card className={`p-4 border transition-all duration-200 hover:border-[#D9C6B7] ${borderColor} ${className}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-[#3B2A1C] text-sm">{finding.pathology}</h4>
            {badge}
          </div>
          <p className="text-xs text-[#6E5D4F]">
            Calibrated Operating Threshold: <span className="text-[#5A4D3B] font-mono">{thresholdPct}%</span>
            {ppv80Pct && (
              <span className="ml-2 text-[#6E5D4F]">
                | PPV80: <span className="text-[#5A4D3B] font-mono">{ppv80Pct}%</span>
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <span
            className={`font-mono text-lg font-bold ${
              isHighSeverity ? 'text-rose-400' : isDetected ? 'text-amber-400' : 'text-[#5A4D3B]'
            }`}
          >
            {percentage.toFixed(1)}%
          </span>
          <span className="block text-[10px] text-[#6E5D4F] uppercase tracking-wider">Confidence</span>
        </div>
      </div>

      {/* Probability Progress Bar with Threshold Marker */}
      <div className="relative mt-3">
        <div className="w-full bg-white rounded-full h-2.5 overflow-hidden border border-[#D9C6B7]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(100, Math.max(2, percentage))}%` }}
          />
        </div>

        {/* Operating Threshold Marker Tick */}
        <div
          className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-amber-400/90 z-10"
          style={{ left: `${Math.min(100, Math.max(0, thresholdPct))}%` }}
          title={`Operating Threshold: ${thresholdPct}%`}
        />

        {/* PPV 80% Marker Tick if applicable */}
        {ppv80Pct && (
          <div
            className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-rose-400/90 z-10"
            style={{ left: `${Math.min(100, Math.max(0, ppv80Pct))}%` }}
            title={`PPV80 Threshold: ${ppv80Pct}%`}
          />
        )}
      </div>

      {/* Legend Footer */}
      <div className="flex items-center justify-between text-[10px] text-[#6E5D4F] mt-2 font-mono">
        <span>0%</span>
        <span className="flex items-center gap-1 text-amber-300/80">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          Op Cutoff: {thresholdPct}%
        </span>
        {ppv80Pct && (
          <span className="flex items-center gap-1 text-rose-300/80">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
            PPV80: {ppv80Pct}%
          </span>
        )}
        <span>100%</span>
      </div>
    </Card>
  );
};
