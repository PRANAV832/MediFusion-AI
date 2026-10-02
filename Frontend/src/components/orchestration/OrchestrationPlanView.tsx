import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/apiClient';
import type {
  OrchestrationPlan,
  SelectedModelItem,
  SkippedCapabilityItem,
  ExecutionStepItem,
  MedicalAsset,
} from '../../types/api';
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
  GitBranch,
  ArrowRight,
  RefreshCw,
  FileText,
  ShieldCheck,
  Zap,
  Info,
  Sliders,
} from 'lucide-react';

interface OrchestrationPlanViewProps {
  caseId: string;
  patientId?: string;
  assets?: MedicalAsset[];
  onSelectCapability?: (capabilityId: string) => void;
}

export const OrchestrationPlanView: React.FC<OrchestrationPlanViewProps> = ({
  caseId,
  assets = [],
  onSelectCapability,
}) => {
  const [plan, setPlan] = useState<OrchestrationPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [replanning, setReplanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symptomsInput, setSymptomsInput] = useState('');
  const [showSymptomsBox, setShowSymptomsBox] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'all' | 'selected' | 'skipped' | 'dag'>('all');
  const [selectedDagNode, setSelectedDagNode] = useState<string | null>(null);

  const fetchPlan = useCallback(
    async (forceReplan = false, customSymptoms?: string) => {
      if (!caseId) return;

      if (forceReplan) {
        setReplanning(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        let res: OrchestrationPlan;
        if (!forceReplan && !customSymptoms) {
          try {
            res = await apiClient.getCasePlan(caseId);
          } catch {
            res = await apiClient.generateCasePlan(caseId, {
              symptoms_context: symptomsInput.trim() || undefined,
              force_replan: false,
            });
          }
        } else {
          res = await apiClient.generateCasePlan(caseId, {
            symptoms_context: customSymptoms?.trim() || symptomsInput.trim() || undefined,
            force_replan: forceReplan,
          });
        }

        setPlan(res);
        if (res.symptoms_context) {
          setSymptomsInput(res.symptoms_context);
        }
      } catch (err: unknown) {
        console.error('Failed to load orchestration plan:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate orchestration plan');
      } finally {
        setLoading(false);
        setReplanning(false);
      }
    },
    [caseId, symptomsInput]
  );


  useEffect(() => {
    fetchPlan(false);
  }, [caseId, assets.length]);

  const getModalityIcon = (modality: string) => {
    switch (modality?.toLowerCase()) {
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
      case 'document':
      case 'clinical_note':
      case 'lab_report':
        return <FileText className="w-4 h-4 text-purple-400" />;
      default:
        return <Layers className="w-4 h-4 text-[#6E5D4F]" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'ready':
      case 'planned':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {status.toUpperCase()}
          </Badge>
        );
      case 'not_configured':
      case 'skipped_not_configured':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-xs">
            <AlertCircle className="w-3 h-3 mr-1" />
            NOT CONFIGURED
          </Badge>
        );
      case 'skipped_no_asset':
        return (
          <Badge variant="outline" className="bg-white text-[#6E5D4F] border-[#D9C6B7] text-xs">
            NO ASSET IN CASE
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-[#FAF6F0] text-[#5A4D3B] border-[#D9C6B7] text-xs">
            {status.toUpperCase()}
          </Badge>
        );
    }
  };

  if (loading && !plan) {
    return (
      <Card className="bg-white border-[#D9C6B7] p-8 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[#8B6F5B] mx-auto" />
        <h4 className="text-sm font-semibold text-[#3B2A1C]">Executing 9-Step Deterministic Model Orchestrator</h4>
        <p className="text-xs text-[#6E5D4F] max-w-md mx-auto">
          Inspecting case modalities, evaluating Model Registry candidates, auditing memory headroom, and synthesizing topological execution DAG...
        </p>
      </Card>
    );
  }

  if (error && !plan) {
    return (
      <Card className="bg-white border-rose-900/50 p-6 space-y-3">
        <div className="flex items-center gap-2 text-rose-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <h4 className="text-sm font-semibold">Orchestration Planning Failed</h4>
        </div>
        <p className="text-xs text-[#6E5D4F]">{error}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchPlan(true)}
          className="border-[#D9C6B7] bg-[#FAF6F0] text-[#3B2A1C] text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry Orchestration
        </Button>
      </Card>
    );
  }

  if (!plan) return null;

  const totalSelected = plan.selected_models.length;
  const totalSkipped = plan.skipped_capabilities.length;
  const totalStages = plan.execution_order.length;
  const ramAvail = plan.resource_snapshot?.available_ram_mb || 0;
  const ramTotal = plan.resource_snapshot?.total_ram_mb || 0;

  return (
    <div className="space-y-6">
      {/* 1. ORCHESTRATION PLAN BANNER */}
      <Card className="bg-white/95 border border-[#D9C6B7] p-5 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2 rounded-lg bg-[#F2E4D5]/70 border border-[#D9C6B7] text-[#8B6F5B]">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#3B2A1C] flex items-center gap-2">
                Deterministic Model Orchestration Plan
              </h3>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-mono">
                {plan.status.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="bg-[#FAF6F0] border-[#D9C6B7] text-[#5A4D3B] text-xs font-mono">
                DAG: {plan.dag?.total_nodes || totalStages} NODES
              </Badge>
            </div>
            <p className="text-xs text-[#6E5D4F] leading-relaxed max-w-3xl">
              {plan.summary}
            </p>
          </div>

          {/* Action Strip */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSymptomsBox(!showSymptomsBox)}
              className="border-[#D9C6B7] bg-[#FAF6F0] hover:bg-[#FAF6F0] text-[#5A4D3B] text-xs"
            >
              <Sliders className="w-3.5 h-3.5 mr-1.5 text-[#8B6F5B]" />
              Context & Symptoms
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchPlan(true)}
              disabled={replanning}
              className="border-cyan-600/50 bg-[#F2E4D5] hover:bg-cyan-900/60 text-cyan-200 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${replanning ? 'animate-spin text-[#8B6F5B]' : ''}`} />
              Re-compute Plan
            </Button>
          </div>
        </div>

        {/* Symptoms & Context Input Expansion */}
        {showSymptomsBox && (
          <div className="mt-4 pt-4 border-t border-[#D9C6B7] space-y-3 bg-[#FCF9F5] p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#5A4D3B] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#8B6F5B]" />
                Clinical Context & Symptom Keywords (influences deterministic scoring):
              </label>
              <span className="text-[11px] text-[#6E5D4F]">e.g. fever, cough, palpitation, headache</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={symptomsInput}
                onChange={(e) => setSymptomsInput(e.target.value)}
                placeholder="Enter symptoms or clinical impressions..."
                className="flex-1 bg-white border border-[#D9C6B7] rounded-lg px-3 py-1.5 text-xs text-[#3B2A1C] focus:outline-none focus:border-[#8B6F5B] font-mono"
              />
              <Button
                size="sm"
                onClick={() => fetchPlan(true, symptomsInput)}
                disabled={replanning}
                className="bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white text-xs px-4"
              >
                Apply & Replan
              </Button>
            </div>
          </div>
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#D9C6B7]">
          <div className="p-2.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7]/70">
            <span className="text-[11px] text-[#6E5D4F] font-medium block">Input Modalities ({plan.input_modalities.length})</span>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {plan.input_modalities.length > 0 ? (
                plan.input_modalities.map((mod) => (
                  <Badge key={mod} variant="outline" className="text-[10px] px-1.5 py-0 uppercase bg-white border-[#D9C6B7] text-[#3B2A1C]">
                    {mod}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-[#6E5D4F]">No assets detected</span>
              )}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7]/70">
            <span className="text-[11px] text-emerald-400 font-medium block">Selected Models</span>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">{totalSelected}</div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7]/70">
            <span className="text-[11px] text-amber-400 font-medium block">Skipped Capabilities</span>
            <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">{totalSkipped}</div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7]/70">
            <span className="text-[11px] text-[#8B6F5B] font-medium block">Available RAM Headroom</span>
            <div className="text-lg font-bold text-[#8B6F5B] font-mono mt-0.5">
              {(ramAvail / 1024).toFixed(1)} GB <span className="text-xs text-[#6E5D4F] font-normal">/ {(ramTotal / 1024).toFixed(1)} GB</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. SECTION TABS / FILTERS */}
      <div className="flex items-center gap-2 border-b border-[#D9C6B7] pb-2 text-xs font-medium">
        <button
          type="button"
          onClick={() => setExpandedSection('all')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            expandedSection === 'all'
              ? 'bg-[#F2E4D5]/70 text-[#8B6F5B] border border-[#8B6F5B]/40 font-semibold'
              : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
          }`}
        >
          All Blueprint Sections
        </button>
        <button
          type="button"
          onClick={() => setExpandedSection('selected')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            expandedSection === 'selected'
              ? 'bg-[#F2E4D5]/70 text-[#8B6F5B] border border-[#8B6F5B]/40 font-semibold'
              : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
          }`}
        >
          <span>Selected Models ({totalSelected})</span>
        </button>
        <button
          type="button"
          onClick={() => setExpandedSection('skipped')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            expandedSection === 'skipped'
              ? 'bg-[#F2E4D5]/70 text-[#8B6F5B] border border-[#8B6F5B]/40 font-semibold'
              : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
          }`}
        >
          <span>Skipped Capabilities ({totalSkipped})</span>
        </button>
        <button
          type="button"
          onClick={() => setExpandedSection('dag')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            expandedSection === 'dag'
              ? 'bg-[#F2E4D5]/70 text-[#8B6F5B] border border-[#8B6F5B]/40 font-semibold'
              : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
          }`}
        >
          <span>Execution Order & DAG ({totalStages})</span>
        </button>
      </div>

      {/* 3. SELECTED MODELS SECTION */}
      {(expandedSection === 'all' || expandedSection === 'selected') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Selected Models & Pipelines ({plan.selected_models.length})
            </h4>
            <span className="text-[11px] text-[#6E5D4F]">Deterministically chosen by capability matcher and resource fit</span>
          </div>

          {plan.selected_models.length === 0 ? (
            <Card className="p-6 bg-white border-[#D9C6B7] text-center py-8">
              <AlertCircle className="w-8 h-8 text-[#6E5D4F] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#5A4D3B]">No runnable models selected for this case</p>
              <p className="text-xs text-[#6E5D4F] mt-1 max-w-md mx-auto">
                No verified compatible models match the ingested assets. Please upload compatible chest radiographs or document records.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plan.selected_models.map((item: SelectedModelItem) => (
                <Card
                  key={item.capability_id}
                  className="p-4 bg-white border-[#D9C6B7]/90 rounded-xl space-y-3 hover:border-[#D9C6B7] transition-all relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] mt-0.5">
                        {getModalityIcon(item.modality)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-bold text-[#3B2A1C]">{item.capability_name}</h5>
                          {getStatusBadge(item.status)}
                        </div>
                        <span className="text-xs font-mono text-[#8B6F5B] block mt-0.5">
                          {item.model_name} ({item.model_id})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Target Asset & Hardware Spec */}
                  <div className="p-2.5 rounded-lg bg-white border border-[#D9C6B7]/70 text-[11px] space-y-1.5 font-mono">
                    <div className="flex items-center justify-between text-[#6E5D4F]">
                      <span>Target Asset:</span>
                      <strong className="text-[#3B2A1C] truncate max-w-[200px]">{item.asset_filename || 'Attached Case Document'}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[#6E5D4F]">
                      <span>Resource Allocation:</span>
                      <span className="text-[#5A4D3B]">{item.estimated_ram_mb} MB RAM • ~{item.estimated_latency_ms} ms</span>
                    </div>
                    <div className="flex items-center justify-between text-[#6E5D4F]">
                      <span>Compute Device:</span>
                      <span className="text-[#5A4D3B] uppercase">{item.device}</span>
                    </div>
                  </div>

                  {/* Deterministic Selection Reason */}
                  <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-xs text-[#5A4D3B] space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Selection Rationale
                    </span>
                    <p className="text-[11px] text-[#5A4D3B] leading-relaxed font-sans">
                      {item.selection_reason}
                    </p>
                  </div>

                  {onSelectCapability && item.status.toLowerCase() === 'ready' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSelectCapability(item.capability_id)}
                      className="w-full border-[#D9C6B7]/50 bg-[#F2E4D5] hover:bg-cyan-900/50 text-[#8B6F5B] text-xs"
                    >
                      <Zap className="w-3.5 h-3.5 mr-1 text-[#8B6F5B]" />
                      Execute Screening Inference
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. SKIPPED CAPABILITIES SECTION */}
      {(expandedSection === 'all' || expandedSection === 'skipped') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Skipped Capabilities ({plan.skipped_capabilities.length})
            </h4>
            <span className="text-[11px] text-[#6E5D4F]">Auditable omissions to guarantee safety and zero fake predictions</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plan.skipped_capabilities.map((item: SkippedCapabilityItem) => {
              const isUnconfigured = item.status === 'skipped_not_configured';
              return (
                <div
                  key={item.capability_id}
                  className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
                    isUnconfigured
                      ? 'bg-amber-950/15 border-amber-500/30'
                      : 'bg-[#FCF9F5] border-[#D9C6B7]/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-white border border-[#D9C6B7]">
                        {getModalityIcon(item.expected_modality)}
                      </div>
                      <span className="font-semibold text-[#3B2A1C]">{item.capability_name}</span>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>

                  <p className="text-[11px] text-[#6E5D4F] leading-relaxed">
                    {item.skip_reason}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-[#6E5D4F] font-mono pt-1 border-t border-[#D9C6B7]">
                    <span>Modality: {item.expected_modality.toUpperCase()}</span>
                    <span>Status: {item.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. EXECUTION ORDER & DIRECTED ACYCLIC GRAPH (DAG) */}
      {(expandedSection === 'all' || expandedSection === 'dag') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#8B6F5B]" />
              Topological Execution Order & DAG Pipeline ({plan.execution_order.length} Stages)
            </h4>
            <span className="text-[11px] text-[#6E5D4F]">Linearized topological sort from directed dependency graph</span>
          </div>

          {/* Execution Pipeline Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {plan.execution_order.map((step: ExecutionStepItem) => {
              const isSelected = selectedDagNode === step.node_id;
              return (
                <div
                  key={step.node_id}
                  onClick={() => setSelectedDagNode(isSelected ? null : step.node_id)}
                  className={`p-3.5 rounded-xl border text-xs space-y-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#F2E4D5] border-[#8B6F5B] ring-1 ring-cyan-500/40 shadow-md'
                      : 'bg-white border-[#D9C6B7] hover:border-[#D9C6B7]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#F2E4D5] border border-[#8B6F5B]/50 text-[#8B6F5B] font-mono text-[11px] font-bold">
                      {step.step_number}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0 bg-[#FAF6F0] border-[#D9C6B7] text-[#6E5D4F]">
                      {step.node_type.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div className="font-semibold text-[#3B2A1C] block truncate" title={step.label}>
                    {step.label}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#6E5D4F] font-mono">
                    <span className="uppercase text-[#8B6F5B]">{step.modality}</span>
                    <span>Ready</span>
                  </div>

                  {step.dependencies.length > 0 && (
                    <div className="text-[10px] text-[#6E5D4F] font-mono truncate">
                      Depends on: {step.dependencies.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* DAG Graph Node / Edge Inspector */}
          {plan.dag?.edges && plan.dag.edges.length > 0 && (
            <Card className="p-4 bg-white border-[#D9C6B7] text-xs space-y-2.5">
              <span className="text-[11px] font-semibold text-[#6E5D4F] uppercase tracking-wider flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-[#8B6F5B]" />
                DAG Edge Dependency Graph ({plan.dag.edges.length} Links):
              </span>
              <div className="flex flex-wrap gap-2">
                {plan.dag.edges.map((edge: { from_node: string; to_node: string; relationship: string }, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-[#D9C6B7] text-[11px] font-mono text-[#5A4D3B]"
                  >
                    <span className="text-[#8B6F5B]">{edge.from_node.replace('node_', '')}</span>
                    <ArrowRight className="w-3 h-3 text-[#6E5D4F]" />
                    <span className="text-emerald-400">{edge.to_node.replace('node_', '')}</span>
                    <span className="text-[10px] text-[#6E5D4F]">({edge.relationship})</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
