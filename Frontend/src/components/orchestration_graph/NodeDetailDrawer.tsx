import React from 'react';
import type { GraphNodeState } from '../../types/api';
import {
  X,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface NodeDetailDrawerProps {
  node: GraphNodeState | null;
  onClose: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const NodeDetailDrawer: React.FC<NodeDetailDrawerProps> = ({ node, onClose, onNavigateToTab }) => {
  if (!node) return null;

  const getTabNavigation = () => {
    switch (node.node_type) {
      case 'INPUTS':
        return null;
      case 'CAPABILITY_SELECTION':
      case 'RESOURCE_CHECK':
        return { tab: 'orchestration', label: 'View 9-Step Orchestration Plan' };
      case 'SPECIALIZED_MODEL':
      case 'MODEL_FINDING':
        return { tab: 'screening', label: 'View Model Screening Execution' };
      case 'EVIDENCE':
        return { tab: 'evidence', label: 'Explore Canonical Evidence DAG' };
      case 'CONFLICT_UNCERTAINTY':
        return { tab: 'conflicts', label: 'Inspect Structured Conflicts' };
      case 'GEMINI':
        return { tab: 'gemini', label: 'Inspect Gemini Evidence-Language Synthesis' };
      default:
        return null;
    }
  };

  const nav = getTabNavigation();

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white border-l border-[#D9C6B7] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#D9C6B7]">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge variant="outline" className="font-mono text-[10px] uppercase text-[#5A4D3B] border-[#D9C6B7] bg-[#F2E4D5]">
                {node.node_type}
              </Badge>
              <Badge
                className={`text-[10px] font-bold border ${
                  node.state === 'COMPLETED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : node.state === 'REVIEW_REQUIRED'
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : node.state === 'RUNNING'
                    ? 'bg-[#F2E4D5] text-[#5A4D3B] border-[#8B6F5B]'
                    : node.state === 'FAILED'
                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                    : 'bg-[#FAF6F0] text-[#6E5D4F] border-[#D9C6B7]'
                }`}
              >
                {node.state}
              </Badge>
            </div>
            <h2 className="text-lg font-bold text-[#3B2A1C]">{node.label}</h2>
            {node.sublabel && <p className="text-xs text-[#6E5D4F] mt-0.5">{node.sublabel}</p>}
          </div>

          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded-lg hover:bg-[#FAF6F0] text-[#6E5D4F] hover:text-[#3B2A1C] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Milestone Summary */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#6E5D4F] uppercase tracking-wider block">
            Milestone Summary
          </label>
          <div className="p-3.5 rounded-xl bg-[#FCF9F5] border border-[#D9C6B7] text-xs text-[#3B2A1C] leading-relaxed">
            {node.summary || 'Stage execution pending.'}
          </div>
        </div>

        {/* Execution Metrics */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7]">
            <span className="text-[#6E5D4F] block text-[10px] uppercase font-semibold">Execution Duration</span>
            <span className="font-mono font-bold text-[#8B6F5B] text-sm mt-0.5 block">
              {node.duration_ms ? `${node.duration_ms} ms` : '—'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7]">
            <span className="text-[#6E5D4F] block text-[10px] uppercase font-semibold">Last Milestone Timestamp</span>
            <span className="font-mono text-[#3B2A1C] text-xs mt-0.5 block">
              {node.updated_at ? new Date(node.updated_at).toLocaleTimeString() : 'Pending'}
            </span>
          </div>
        </div>

        {/* Granular Payload / Details */}
        {node.details && Object.keys(node.details).length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#6E5D4F] uppercase tracking-wider block">
              Stage Audit Metadata & Payloads
            </label>
            <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#D9C6B7] overflow-x-auto">
              <pre className="font-mono text-[11px] text-[#3B2A1C] leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(node.details, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      {nav && onNavigateToTab && (
        <div className="pt-6 border-t border-[#D9C6B7] mt-6">
          <Button
            onClick={() => {
              onNavigateToTab(nav.tab);
              onClose();
            }}
            className="w-full bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm"
          >
            <span>{nav.label}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

