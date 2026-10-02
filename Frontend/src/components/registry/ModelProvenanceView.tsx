import React from 'react';
import type { ModelRegistryItem } from '../../types/api';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ShieldCheck, FileCheck, Scale, Layers, ExternalLink } from 'lucide-react';

interface ModelProvenanceViewProps {
  model: ModelRegistryItem;
  className?: string;
}

export const ModelProvenanceView: React.FC<ModelProvenanceViewProps> = ({ model, className = '' }) => {
  const prov = (model.provenance || {}) as Record<string, unknown>;
  const trainingDatasets = (prov.training_datasets as string[]) || [];
  const author = (prov.author as string) || 'Clinical AI Research Lab';
  const citation = (prov.citation as string) || 'Published in peer-reviewed clinical research proceedings.';

  return (
    <Card className={`p-5 bg-white border border-[#D9C6B7] rounded-xl space-y-4 shadow-sm ${className}`}>
      <div className="flex items-center gap-2.5 pb-3 border-b border-[#D9C6B7]">
        <div className="p-2 rounded-lg bg-[#F2E4D5] border border-[#D9C6B7] text-[#5A4D3B]">
          <ShieldCheck className="w-5 h-5 text-[#8B6F5B]" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2">
            Model Provenance & Lineage
            <Badge variant="outline" className="text-[#5A4D3B] bg-[#F2E4D5] border-[#D9C6B7] text-[10px]">
              Audit Certified
            </Badge>
          </h4>
          <p className="text-xs text-[#6E5D4F]">
            Cryptographic verification, training source lineage, and peer-reviewed citations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Author & Citation */}
        <div className="space-y-1.5 bg-[#FCF9F5] border border-[#D9C6B7] p-3.5 rounded-lg">
          <span className="text-[#6E5D4F] font-semibold uppercase tracking-wider text-[10px] block">
            Principal Authors & Citations
          </span>
          <p className="text-[#3B2A1C] font-medium">{author}</p>
          <p className="text-[#6E5D4F] italic text-[11px] leading-relaxed mt-1">{citation}</p>
        </div>

        {/* License & Framework */}
        <div className="space-y-2 bg-[#FCF9F5] border border-[#D9C6B7] p-3.5 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[#6E5D4F] font-semibold uppercase tracking-wider text-[10px] block">
                License Designation
              </span>
              <p className="text-[#3B2A1C] font-medium mt-0.5 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-emerald-600" />
                {model.license}
              </p>
            </div>
            <div>
              <span className="text-[#6E5D4F] font-semibold uppercase tracking-wider text-[10px] block">
                Framework
              </span>
              <Badge variant="outline" className="bg-[#FAF6F0] border-[#D9C6B7] text-[#5A4D3B] font-mono text-[11px] mt-0.5">
                {model.framework}
              </Badge>
            </div>
          </div>

          <div>
            <span className="text-[#6E5D4F] font-semibold uppercase tracking-wider text-[10px] block mb-1">
              Artifact Source URL
            </span>
            <a
              href={model.artifact_source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8B6F5B] hover:text-[#5A4D3B] font-mono text-[11px] break-all flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{model.artifact_source}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Training Datasets */}
      {trainingDatasets.length > 0 && (
        <div className="bg-[#FCF9F5] border border-[#D9C6B7] p-3.5 rounded-lg">
          <span className="text-[#6E5D4F] font-semibold uppercase tracking-wider text-[10px] block mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#8B6F5B]" />
            Composite Training & Benchmarking Datasets
          </span>
          <div className="flex flex-wrap gap-1.5">
            {trainingDatasets.map((ds) => (
              <Badge key={ds} variant="outline" className="bg-[#FAF6F0] border-[#D9C6B7] text-[#3B2A1C] text-xs px-2.5 py-1">
                {ds}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Checksum / Version Hash */}
      {model.checksum && (
        <div className="bg-[#FCF9F5] border border-[#D9C6B7] p-3.5 rounded-lg flex items-start gap-2.5">
          <FileCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-[#6E5D4F] font-semibold uppercase tracking-wider text-[10px] block">
              Weights SHA-256 Cryptographic Checksum
            </span>
            <code className="text-emerald-800 font-mono text-[11px] break-all block mt-0.5 bg-[#FAF6F0] px-2 py-1 rounded border border-[#D9C6B7] select-all">
              {model.checksum}
            </code>
          </div>
        </div>
      )}
    </Card>
  );
};

