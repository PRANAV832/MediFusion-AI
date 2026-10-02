import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { AlertTriangle, AlertOctagon } from 'lucide-react';

interface ModelLimitationsViewProps {
  limitations: string[];
  className?: string;
}

export const ModelLimitationsView: React.FC<ModelLimitationsViewProps> = ({
  limitations,
  className = '',
}) => {
  return (
    <Card className={`p-5 bg-white border border-[#D9C6B7] rounded-xl space-y-4 shadow-sm ${className}`}>
      <div className="flex items-center gap-2.5 pb-3 border-b border-[#D9C6B7]">
        <div className="p-2 rounded-lg bg-[#F2E4D5] border border-[#D9C6B7] text-[#8B6F5B]">
          <AlertTriangle className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2">
            Documented Clinical Limitations & Contraindications
            <Badge variant="outline" className="text-amber-900 bg-amber-50 border-amber-300 text-[10px]">
              Safety Mandatory
            </Badge>
          </h4>
          <p className="text-xs text-[#6E5D4F]">
            Known clinical scope boundaries, sensor sensitivity caveats, and non-supported scenarios
          </p>
        </div>
      </div>

      {/* Safety Notice Callout */}
      <div className="p-3.5 rounded-lg bg-amber-50/80 border border-amber-300 text-amber-950 text-xs flex items-start gap-3">
        <AlertOctagon className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-amber-900 block">
            Clinical Safety Protocol
          </span>
          <p className="text-amber-900/90 leading-relaxed text-[11px]">
            MediFusion AI models provide quantitative screening and decision-support assistance only. They are not certified as standalone primary diagnostic devices. All flagged findings, heatmaps, and probability indices must be reviewed and confirmed by an authorized clinician or board-certified radiologist.
          </p>
        </div>
      </div>

      {/* Limitations List */}
      <div className="space-y-2.5">
        {limitations && limitations.length > 0 ? (
          limitations.map((limitation, index) => (
            <div
              key={index}
              className="p-3 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] flex items-start gap-2.5 text-xs text-[#3B2A1C] leading-relaxed"
            >
              <span className="font-bold text-amber-700 text-sm leading-none mt-0.5">•</span>
              <span>{limitation}</span>
            </div>
          ))
        ) : (
          <div className="p-4 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] text-[#6E5D4F] text-xs text-center">
            No specific clinical contraindications documented for this model.
          </div>
        )}
      </div>
    </Card>
  );
};

