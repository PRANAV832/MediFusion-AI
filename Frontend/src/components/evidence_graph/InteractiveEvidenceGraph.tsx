import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { apiClient } from '../../services/apiClient';
import type {
  CanonicalCaseEvidenceGraph,
  CanonicalEvidenceItem,
  CanonicalEvidenceType,
  CanonicalFinding,
} from '../../types/api';
import { EvidenceNodeComponent, type EvidenceNodeData } from './EvidenceNodeComponent';
import { EvidenceProvenancePanel } from './EvidenceProvenancePanel';
import {
  GitMerge,
  RefreshCw,
  Search,
  Brain,
  FileText,
  BookOpen,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface InteractiveEvidenceGraphProps {
  caseId: string;
  patientId?: string;
  onNavigateToTab?: (tab: string) => void;
}

const nodeTypes = {
  evidenceNode: EvidenceNodeComponent,
};

export const InteractiveEvidenceGraph: React.FC<InteractiveEvidenceGraphProps> = ({
  caseId,
  patientId,
  onNavigateToTab,
}) => {
  const [graphData, setGraphData] = useState<CanonicalCaseEvidenceGraph | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedNode, setSelectedNode] = useState<EvidenceNodeData | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'ALL' | CanonicalEvidenceType | 'CONFLICT'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSubProvenance, setShowSubProvenance] = useState<boolean>(true);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const fetchGraph = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const data = await apiClient.getCaseEvidenceGraph(caseId, patientId);
      setGraphData(data);
    } catch (e) {
      console.error('Error fetching evidence graph:', e);
    } finally {
      setLoading(false);
    }
  }, [caseId, patientId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const handleSelectNode = useCallback((nodeData: EvidenceNodeData) => {
    setSelectedNode(nodeData);
  }, []);

  // Construct React Flow graph with genuine stored provenance edges
  useEffect(() => {
    if (!graphData) return;

    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];
    const nodeIds = new Set<string>();

    const q = searchQuery.toLowerCase().trim();

    // 1. Position Findings (Layer 1: Top, Y = 50)
    let findingX = 50;
    const findingMap = new Map<string, CanonicalFinding>();

    graphData.findings.forEach((finding) => {
      findingMap.set(finding.id, finding);
      if (q && !finding.label.toLowerCase().includes(q)) return;

      const fNodeData: EvidenceNodeData = {
        id: finding.id,
        nodeType: 'FINDING',
        label: finding.label,
        sublabel: `Status: ${finding.status} • Severity: ${finding.severity}`,
        evidenceType: finding.source_evidence_type,
        confidence: finding.confidence,
        severity: finding.severity,
        status: finding.status,
        excerpt: finding.clinical_notes,
        tracePath: finding.provenance?.trace_path || [],
        rawItem: finding,
        onSelectNode: handleSelectNode,
      };

      flowNodes.push({
        id: finding.id,
        type: 'evidenceNode',
        position: { x: findingX, y: 50 },
        data: fNodeData,
      });
      nodeIds.add(finding.id);
      findingX += 290;
    });

    // 2. Position Evidence Items (Layer 2: Middle, Y = 280)
    // Group items by type for clean organized columns
    let eviX = 50;
    const itemMap = new Map<string, CanonicalEvidenceItem>();

    graphData.evidence_items.forEach((item) => {
      itemMap.set(item.id, item);

      // Apply type filter
      if (typeFilter !== 'ALL' && typeFilter !== 'CONFLICT' && item.evidence_type !== typeFilter) {
        return;
      }
      // Apply search filter
      if (
        q &&
        !item.title.toLowerCase().includes(q) &&
        !item.summary.toLowerCase().includes(q)
      ) {
        return;
      }

      const eNodeData: EvidenceNodeData = {
        id: item.id,
        nodeType: item.evidence_type as any,
        label: item.title,
        sublabel: item.modality || item.provenance?.source_name || item.provenance?.generator,
        evidenceType: item.evidence_type,
        confidence: item.confidence,
        excerpt: item.summary,
        tracePath: item.provenance?.trace_path || [],
        rawItem: item,
        onSelectNode: handleSelectNode,
      };

      flowNodes.push({
        id: item.id,
        type: 'evidenceNode',
        position: { x: eviX, y: 300 },
        data: eNodeData,
      });
      nodeIds.add(item.id);

      // 3. Sub-Provenance Nodes if expanded (Layer 3: Bottom, Y = 520)
      if (showSubProvenance) {
        const prov = item.provenance;
        if (item.evidence_type === 'MODEL_FINDING' && prov?.source_asset_filename) {
          const assetNodeId = `asset-${item.id}`;
          if (!nodeIds.has(assetNodeId)) {
            flowNodes.push({
              id: assetNodeId,
              type: 'evidenceNode',
              position: { x: eviX - 20, y: 520 },
              data: {
                id: assetNodeId,
                nodeType: 'SOURCE_ASSET',
                label: prov.source_asset_filename,
                sublabel: `Model: ${prov.model_name || prov.model_id}`,
                excerpt: `Source radiograph asset processed for run #${prov.model_run_id?.slice(0, 8) || 'N/A'}`,
                tracePath: prov.trace_path,
                rawItem: item,
                onSelectNode: handleSelectNode,
              },
            });
            nodeIds.add(assetNodeId);
          }

          // Genuine edge: Model Finding -> Source Asset
          flowEdges.push({
            id: `edge-${item.id}-${assetNodeId}`,
            source: item.id,
            target: assetNodeId,
            animated: true,
            style: { stroke: '#06b6d4', strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#06b6d4' },
          });
        } else if (item.evidence_type === 'PATIENT_RECORD' && prov?.document_filename) {
          const docNodeId = `chunk-${item.id}`;
          if (!nodeIds.has(docNodeId)) {
            flowNodes.push({
              id: docNodeId,
              type: 'evidenceNode',
              position: { x: eviX - 20, y: 520 },
              data: {
                id: docNodeId,
                nodeType: 'CHUNK',
                label: `Page ${prov.page_number} • Chunk #${prov.chunk_index}`,
                sublabel: prov.document_filename,
                excerpt: item.content || item.summary,
                tracePath: prov.trace_path,
                rawItem: item,
                onSelectNode: handleSelectNode,
              },
            });
            nodeIds.add(docNodeId);
          }

          // Genuine edge: Patient Record -> Document Chunk
          flowEdges.push({
            id: `edge-${item.id}-${docNodeId}`,
            source: item.id,
            target: docNodeId,
            style: { stroke: '#10b981', strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
          });
        }
      }

      eviX += 290;
    });

    // 4. Edges from Evidence Links (Must correspond to stored relationships)
    graphData.links.forEach((link) => {
      // Ensure both source and target exist in visible nodes
      if (nodeIds.has(link.source_id) && nodeIds.has(link.target_evidence_id)) {
        let edgeColor = '#06b6d4'; // default SUPPORTS
        let isAnimated = false;
        let strokeDasharray: string | undefined = undefined;

        if (link.link_type === 'CONTRADICTS') {
          edgeColor = '#f43f5e'; // red for contradictions
          isAnimated = true;
          strokeDasharray = '5 5';
        } else if (link.link_type === 'DERIVED_FROM') {
          edgeColor = '#f59e0b'; // amber for Gemini synthesis derivations
        } else if (link.link_type === 'CONTEXTUALIZES') {
          edgeColor = '#a855f7'; // purple for guidelines
        }

        flowEdges.push({
          id: link.id,
          source: link.source_id,
          target: link.target_evidence_id,
          animated: isAnimated,
          style: {
            stroke: edgeColor,
            strokeWidth: link.link_type === 'CONTRADICTS' ? 2.5 : 1.8,
            strokeDasharray,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
          },
        });
      }
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [graphData, typeFilter, searchQuery, showSubProvenance, handleSelectNode, setNodes, setEdges]);

  const stats = useMemo(() => {
    return graphData?.stats || {
      total_evidence_items: 0,
      model_findings_count: 0,
      patient_records_count: 0,
      trusted_knowledge_count: 0,
      generated_synthesis_count: 0,
      findings_count: 0,
      links_count: 0,
    };
  }, [graphData]);

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* FILTER STRIP & GRAPH CONTROLS */}
      {/* ========================================================================= */}
      <Card className="p-4 bg-white border border-[#D9C6B7] space-y-3 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <GitMerge className="w-5 h-5 text-[#8B6F5B]" />
              <h2 className="text-base font-bold text-[#3B2A1C]">
                Interactive Evidence Graph
              </h2>
              <Badge variant="outline" className="text-[10px] bg-[#F2E4D5] border-[#D9C6B7] text-[#5A4D3B]">
                PHASE 14 • GENUINE PROVENANCE ONLY
              </Badge>
            </div>
            <p className="text-xs text-[#6E5D4F]">
              Interactive React Flow graph tracing real evidence dependencies: Finding → Model Run → Source Image,
              Finding → Patient Record → Document Chunk, and Gemini Synthesis → Supporting Items.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6E5D4F]" />
              <input
                type="text"
                placeholder="Search label, summary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs bg-[#FAF6F0] border border-[#D9C6B7] rounded-lg text-[#3B2A1C] placeholder:text-[#6E5D4F] focus:outline-none focus:border-[#8B6F5B] w-48 sm:w-56"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSubProvenance(!showSubProvenance)}
              className={`text-xs border-[#D9C6B7] ${showSubProvenance ? 'bg-[#F2E4D5] text-[#5A4D3B] border-[#8B6F5B]' : 'bg-white text-[#6E5D4F]'}`}
            >
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              {showSubProvenance ? 'Hide Source Slices' : 'Show Source Slices'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchGraph}
              disabled={loading}
              className="text-xs border-[#D9C6B7] bg-white text-[#5A4D3B] hover:bg-[#FAF6F0]"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Evidence-Type Filter Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#D9C6B7] text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#6E5D4F] font-semibold mr-1">FILTER TYPE:</span>

            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                typeFilter === 'ALL'
                  ? 'bg-[#8B6F5B] text-white border border-[#8B6F5B]'
                  : 'bg-[#FAF6F0] text-[#6E5D4F] border border-[#D9C6B7] hover:text-[#3B2A1C]'
              }`}
            >
              All Types ({stats.total_evidence_items})
            </button>

            <button
              onClick={() => setTypeFilter('MODEL_FINDING')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                typeFilter === 'MODEL_FINDING'
                  ? 'bg-sky-100 text-sky-900 border border-sky-400'
                  : 'bg-[#FAF6F0] text-[#6E5D4F] border border-[#D9C6B7] hover:text-[#3B2A1C]'
              }`}
            >
              <Brain className="w-3 h-3 text-sky-700" />
              Model Findings ({stats.model_findings_count})
            </button>

            <button
              onClick={() => setTypeFilter('PATIENT_RECORD')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                typeFilter === 'PATIENT_RECORD'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-400'
                  : 'bg-[#FAF6F0] text-[#6E5D4F] border border-[#D9C6B7] hover:text-[#3B2A1C]'
              }`}
            >
              <FileText className="w-3 h-3 text-emerald-700" />
              Patient Records ({stats.patient_records_count})
            </button>

            <button
              onClick={() => setTypeFilter('TRUSTED_KNOWLEDGE')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                typeFilter === 'TRUSTED_KNOWLEDGE'
                  ? 'bg-purple-100 text-purple-900 border border-purple-400'
                  : 'bg-[#FAF6F0] text-[#6E5D4F] border border-[#D9C6B7] hover:text-[#3B2A1C]'
              }`}
            >
              <BookOpen className="w-3 h-3 text-purple-700" />
              Clinical Guidelines ({stats.trusted_knowledge_count})
            </button>

            <button
              onClick={() => setTypeFilter('GENERATED_SYNTHESIS')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                typeFilter === 'GENERATED_SYNTHESIS'
                  ? 'bg-amber-100 text-amber-900 border border-amber-400'
                  : 'bg-[#FAF6F0] text-[#6E5D4F] border border-[#D9C6B7] hover:text-[#3B2A1C]'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-700" />
              Gemini Syntheses ({stats.generated_synthesis_count})
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[#6E5D4F] font-mono">
            <span>
              Findings: <strong className="text-[#8B6F5B]">{stats.findings_count}</strong>
            </span>
            <span>•</span>
            <span>
              DAG Provenance Links: <strong className="text-[#3B2A1C]">{stats.links_count}</strong>
            </span>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* REACT FLOW CANVAS */}
      {/* ========================================================================= */}
      <div className="h-[740px] rounded-xl border border-[#D9C6B7] bg-[#FCF9F5] overflow-hidden relative shadow-inner">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#D9C6B7" gap={20} size={1} />
          <Controls className="!bg-white !border-[#D9C6B7] !text-[#5A4D3B]" />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-white/90 !border !border-[#D9C6B7] !rounded-lg"
            nodeColor={(n) => {
              const t = n.data?.nodeType;
              if (t === 'FINDING') return '#8B6F5B';
              if (t === 'MODEL_FINDING') return '#0284c7';
              if (t === 'PATIENT_RECORD') return '#059669';
              if (t === 'TRUSTED_KNOWLEDGE') return '#9333ea';
              if (t === 'GENERATED_SYNTHESIS') return '#d97706';
              if (t === 'SOURCE_ASSET') return '#5A4D3B';
              return '#B89A7D';
            }}
          />
        </ReactFlow>

        {/* Floating Legend */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm p-2.5 rounded-lg border border-[#D9C6B7] text-[10px] space-y-1.5 font-mono text-[#5A4D3B] pointer-events-none shadow-sm">
          <div className="text-[11px] font-bold text-[#3B2A1C] uppercase">Provenance Graph Legend</div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B6F5B]"></span>
            <span>Clinical Finding</span>
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600 ml-2"></span>
            <span>Model Finding</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 ml-2"></span>
            <span>Patient Record</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
            <span>Clinical Guideline</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600 ml-2"></span>
            <span>Gemini Synthesis</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 ml-2"></span>
            <span>Contradiction Link</span>
          </div>
        </div>
      </div>


      {/* Provenance Panel Drawer */}
      <EvidenceProvenancePanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onNavigateToTab={onNavigateToTab}
      />
    </div>
  );
};
