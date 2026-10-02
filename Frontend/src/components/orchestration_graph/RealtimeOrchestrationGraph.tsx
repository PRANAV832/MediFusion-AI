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
  GraphNodeState,
  OrchestrationEventItem,
  OrchestrationRunSummary,
  ReconstructedGraphState,
} from '../../types/api';
import { StageNodeComponent } from './StageNodeComponent';
import { EventTimelineStream } from './EventTimelineStream';
import { NodeDetailDrawer } from './NodeDetailDrawer';
import {
  Play,
  RefreshCw,
  GitBranch,
  ShieldAlert,
  History,
  Terminal,
} from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface RealtimeOrchestrationGraphProps {
  caseId: string;
  patientId?: string;
  onNavigateToTab?: (tab: string) => void;
}

const nodeTypes = {
  stageNode: StageNodeComponent,
};

// Layout coordinates: Vertical cascade of the 10 sequential clinical stages
const NODE_LAYOUT_Y: Record<string, number> = {
  CASE: 20,
  INPUTS: 180,
  CAPABILITY_SELECTION: 340,
  RESOURCE_CHECK: 500,
  SPECIALIZED_MODEL: 660,
  MODEL_FINDING: 820,
  EVIDENCE: 980,
  CONFLICT_UNCERTAINTY: 1140,
  GEMINI: 1300,
  REPORT: 1460,
};

export const RealtimeOrchestrationGraph: React.FC<RealtimeOrchestrationGraphProps> = ({
  caseId,
  onNavigateToTab,
}) => {
  const [graphData, setGraphData] = useState<ReconstructedGraphState | null>(null);
  const [runs, setRuns] = useState<OrchestrationRunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNodeState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [executing, setExecuting] = useState<boolean>(false);
  const [showEventStream, setShowEventStream] = useState<boolean>(true);
  const [liveWsEvents, setLiveWsEvents] = useState<OrchestrationEventItem[]>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 1. Fetch historical runs and initial graph reconstruction
  const loadGraphAndRuns = useCallback(async (runId?: string) => {
    if (!caseId) return;
    setLoading(true);
    try {
      const [graphRes, runsRes] = await Promise.all([
        apiClient.getCaseOrchestrationGraph(caseId, runId),
        apiClient.listCaseOrchestrationRuns(caseId),
      ]);
      setGraphData(graphRes);
      setRuns(runsRes);
      if (runId) {
        setSelectedRunId(runId);
      } else if (graphRes.run_id && !graphRes.run_id.startsWith('initial-queued-')) {
        setSelectedRunId(graphRes.run_id);
      }
    } catch (err) {
      console.error('Error fetching orchestration graph:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadGraphAndRuns();
  }, [loadGraphAndRuns]);

  // Handle clicking a node to inspect audit drawer
  const handleSelectNode = useCallback(
    (nodeId: string) => {
      if (!graphData) return;
      const target = graphData.nodes.find((n) => n.id === nodeId);
      if (target) {
        setSelectedNode(target);
      }
    },
    [graphData]
  );

  // Synchronize React Flow nodes & edges whenever graphData changes
  useEffect(() => {
    if (!graphData) return;

    const flowNodes: Node[] = graphData.nodes.map((node) => ({
      id: node.id,
      type: 'stageNode',
      position: { x: 120, y: NODE_LAYOUT_Y[node.id] || 0 },
      data: {
        stage: node.node_type,
        label: node.label,
        sublabel: node.sublabel,
        state: node.state,
        duration_ms: node.duration_ms,
        summary: node.summary,
        details: node.details,
        onSelectNode: handleSelectNode,
      },
    }));

    const flowEdges: Edge[] = graphData.edges.map((edge) => {
      let strokeColor = '#D9C6B7'; // default Soft Sand
      if (edge.status === 'completed') strokeColor = '#059669'; // emerald-600
      if (edge.status === 'active') strokeColor = '#8B6F5B'; // Mocha
      if (edge.status === 'error') strokeColor = '#e11d48'; // rose-600
      if (edge.status === 'review') strokeColor = '#d97706'; // amber-600

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: edge.animated || edge.status === 'active',
        style: {
          stroke: strokeColor,
          strokeWidth: edge.status === 'active' || edge.status === 'completed' ? 2.5 : 1.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
        },
      };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [graphData, handleSelectNode, setNodes, setEdges]);

  // 2. Trigger Real-Time Orchestration via WebSocket Stream (Zero fake timers)
  const triggerLiveExecution = async () => {
    if (executing || !caseId) return;
    setExecuting(true);
    setLiveWsEvents([]);

    // Determine WebSocket protocol (ws: or wss:)
    const loc = window.location;
    const wsProto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use localhost:8000 or current host
    const wsUrl = `${wsProto}//${loc.hostname}:8000/api/v1/orchestration-graph/ws/case/${caseId}?throttle_ms=180`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'ORCHESTRATION_COMPLETED') {
            if (payload.graph) {
              setGraphData(payload.graph);
            }
            setExecuting(false);
            ws.close();
            // Refresh runs list
            apiClient.listCaseOrchestrationRuns(caseId).then(setRuns);
          } else if (payload.type === 'ORCHESTRATION_ERROR') {
            console.error('Orchestration streaming error:', payload.error);
            setExecuting(false);
            ws.close();
          } else if (payload.event_type) {
            // Live granular event emitted by real backend step
            setLiveWsEvents((prev) => [...prev, payload]);

            // Optimistically advance node state in React Flow graph
            setGraphData((currentGraph) => {
              if (!currentGraph) return currentGraph;
              const updatedNodes = currentGraph.nodes.map((n) => {
                if (n.id === payload.stage_node) {
                  return {
                    ...n,
                    state: payload.state,
                    summary: payload.message,
                    duration_ms: payload.duration_ms || n.duration_ms,
                    updated_at: payload.created_at,
                    details: { ...n.details, ...payload.payload },
                  };
                }
                return n;
              });

              return {
                ...currentGraph,
                nodes: updatedNodes,
                events: [...currentGraph.events, payload],
                active_stage: payload.stage_node,
              };
            });
          }
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      ws.onerror = async (err) => {
        console.warn('WebSocket stream unavailable, falling back to HTTP sync execution:', err);
        ws.close();
        try {
          const syncGraph = await apiClient.executeCaseOrchestration(caseId, true);
          setGraphData(syncGraph);
          const updatedRuns = await apiClient.listCaseOrchestrationRuns(caseId);
          setRuns(updatedRuns);
        } catch (e) {
          console.error('HTTP execution failed:', e);
        } finally {
          setExecuting(false);
        }
      };
    } catch (e) {
      console.warn('Could not open WebSocket, running HTTP sync fallback:', e);
      try {
        const syncGraph = await apiClient.executeCaseOrchestration(caseId, true);
        setGraphData(syncGraph);
      } catch (err) {
        console.error('Fallback sync execution error:', err);
      } finally {
        setExecuting(false);
      }
    }
  };

  // Replay historical run selection
  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
    loadGraphAndRuns(runId);
  };

  const activeEvents = useMemo(() => {
    if (executing && liveWsEvents.length > 0) return liveWsEvents;
    return graphData?.events || [];
  }, [executing, liveWsEvents, graphData]);

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* HEADER CONTROLS & LIFECYCLE HERO */}
      {/* ========================================================================= */}
      <Card className="p-4 bg-white border border-[#D9C6B7] shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-[#8B6F5B]" />
              <h2 className="text-base font-bold text-[#3B2A1C]">
                Real-Time Clinical Orchestration Graph
              </h2>
              <Badge variant="outline" className="text-[10px] bg-[#FAF6F0] border-[#D9C6B7] text-[#5A4D3B]">
                PHASE 13 • ZERO FAKE TIMERS
              </Badge>
            </div>
            <p className="text-xs text-[#6E5D4F]">
              Interactive React Flow execution graph reflecting actual backend milestones: Intake → Assets →
              Capability → Hardware → Specialized AI → Evidence → Conflicts → Gemini → Report.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Historical Run Selector */}
            {runs.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[#FAF6F0] px-2.5 py-1.5 rounded-lg border border-[#D9C6B7] text-xs text-[#3B2A1C]">
                <History className="w-3.5 h-3.5 text-[#8B6F5B]" />
                <span className="text-[11px] text-[#6E5D4F] font-semibold">Run:</span>
                <select
                  value={selectedRunId || ''}
                  onChange={(e) => handleSelectRun(e.target.value)}
                  className="bg-transparent text-xs text-[#3B2A1C] font-mono focus:outline-none cursor-pointer"
                >
                  {runs.map((r) => (
                    <option key={r.id} value={r.id} className="bg-white text-[#3B2A1C]">
                      {`Run #${r.id.slice(0, 8)} (${r.state}) — ${new Date(r.created_at).toLocaleTimeString()}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadGraphAndRuns(selectedRunId || undefined)}
              disabled={loading || executing}
              className="text-xs border-[#D9C6B7] bg-white text-[#5A4D3B] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Graph
            </Button>

            <Button
              size="sm"
              onClick={triggerLiveExecution}
              disabled={executing}
              className="text-xs font-semibold shadow-sm"
            >
              <Play className={`w-3.5 h-3.5 mr-1.5 fill-current ${executing ? 'animate-pulse' : ''}`} />
              {executing ? 'Executing Real Pipeline...' : 'Trigger Live Execution'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEventStream(!showEventStream)}
              className="text-xs border-[#D9C6B7] bg-white text-[#5A4D3B] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]"
            >
              <Terminal className="w-3.5 h-3.5 mr-1.5 text-[#8B6F5B]" />
              {showEventStream ? 'Hide Events' : 'Show Events'}
            </Button>
          </div>
        </div>

        {/* Status Strip & Graph Metrics */}
        {graphData && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#D9C6B7]/60 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-[#6E5D4F] font-semibold">Run State:</span>
              <Badge
                className={`text-[11px] font-bold ${
                  graphData.overall_state === 'COMPLETED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : graphData.overall_state === 'REVIEW_REQUIRED'
                    ? 'bg-amber-50 text-amber-900 border-amber-300 animate-pulse'
                    : graphData.overall_state === 'RUNNING'
                    ? 'bg-[#F2E4D5] text-[#3B2A1C] border-[#8B6F5B]'
                    : 'bg-[#FAF6F0] text-[#6E5D4F] border-[#D9C6B7]'
                }`}
              >
                {graphData.overall_state}
              </Badge>

              {graphData.has_review_required && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <ShieldAlert className="w-3 h-3 text-amber-600" />
                  Clinician Adjudication Required
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-[11px] text-[#6E5D4F] font-mono">
              <span>
                Stages Completed:{' '}
                <strong className="text-[#3B2A1C]">
                  {graphData.completed_nodes_count}/{graphData.total_nodes_count}
                </strong>
              </span>
              <span>•</span>
              <span>
                Total Duration:{' '}
                <strong className="text-[#3B2A1C]">{graphData.total_duration_ms} ms</strong>
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* MAIN WORKSPACE: REACT FLOW CANVAS & CHRONOLOGICAL TRACE STREAM */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* React Flow Graph Canvas */}
        <div className={`${showEventStream ? 'lg:col-span-8' : 'lg:col-span-12'} h-[720px] rounded-xl border border-[#D9C6B7] bg-[#FAF6F0] overflow-hidden relative shadow-sm`}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.4}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#D9C6B7" gap={20} size={1} />
            <Controls className="!bg-white !border-[#D9C6B7] !text-[#5A4D3B]" />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="!bg-white/95 !border !border-[#D9C6B7] !rounded-lg"
              nodeColor={(n) => {
                const s = n.data?.state;
                if (s === 'COMPLETED') return '#059669';
                if (s === 'REVIEW_REQUIRED') return '#d97706';
                if (s === 'RUNNING') return '#8B6F5B';
                if (s === 'FAILED') return '#e11d48';
                return '#D9C6B7';
              }}
            />
          </ReactFlow>

          {/* Canvas Floating Legend */}
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm p-2.5 rounded-lg border border-[#D9C6B7] text-[10px] space-y-1 font-mono text-[#6E5D4F] pointer-events-none shadow-sm">
            <div className="text-[11px] font-bold text-[#3B2A1C] uppercase">Interactive Node Controls</div>
            <div>• Click any stage node to inspect full payload & audit trail</div>
            <div>• Real-time edge pulse updates dynamically with backend execution</div>
          </div>
        </div>

        {/* Chronological Event Stream Panel */}
        {showEventStream && (
          <div className="lg:col-span-4 h-[720px]">
            <EventTimelineStream
              events={activeEvents}
              activeStage={graphData?.active_stage}
            />
          </div>
        )}
      </div>

      {/* Deep-Dive Stage Node Drawer */}
      <NodeDetailDrawer
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onNavigateToTab={onNavigateToTab}
      />
    </div>
  );
};
