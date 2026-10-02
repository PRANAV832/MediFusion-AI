import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../services/apiClient';
import { RealtimeOrchestrationGraph } from '../components/orchestration_graph';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton, CardSkeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import {
  ReviewStateBadge,
  PriorityBadge,
  MedicalSafetyBanner,
} from '../components/ui/clinical-badges';
import {
  Activity,
  ChevronRight,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

export const LiveOrchestrationPage: React.FC = () => {
  const { caseId: paramCaseId } = useParams<{ caseId?: string }>();
  const navigate = useNavigate();

  const [cases, setCases] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(paramCaseId || null);
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Synchronize route param with state
  useEffect(() => {
    if (paramCaseId) {
      setSelectedCaseId(paramCaseId);
    }
  }, [paramCaseId]);

  const fetchCases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.getCases();
      const items = Array.isArray(res) ? res : (res as any)?.items || (res as any)?.cases || [];
      setCases(items);

      // Auto-select first case if none specified
      if (!selectedCaseId && items.length > 0) {
        setSelectedCaseId(items[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve active clinical cases for orchestration telemetry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  // Update selected case object when list or ID changes
  useEffect(() => {
    if (selectedCaseId && cases.length > 0) {
      const found = cases.find((c) => c.id === selectedCaseId);
      if (found) setSelectedCase(found);
    }
  }, [selectedCaseId, cases]);

  const handleSelectCase = (id: string) => {
    setSelectedCaseId(id);
    navigate(`/orchestration/${id}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Safety */}
      <MedicalSafetyBanner />

      {/* Screen Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
                Live Multi-Agent Orchestration
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Deterministic DAG pipeline execution, state machine inspection & event telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Case Selector Dropdown */}
        <div className="flex flex-wrap items-center gap-2.5">
          {cases.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
              <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
              <label htmlFor="orchestration-case-select" className="text-slate-400 font-medium">
                Active Case:
              </label>
              <select
                id="orchestration-case-select"
                value={selectedCaseId || ''}
                onChange={(e) => handleSelectCase(e.target.value)}
                className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-slate-200">
                    #{c.id.slice(0, 8)} — {c.patient_name || c.patient_id || 'Patient'} ({c.priority || 'ROUTINE'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={fetchCases}
            disabled={isLoading}
            className="border-slate-700 text-slate-300 hover:text-slate-100 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {selectedCaseId && (
            <Link to={`/cases/${selectedCaseId}`}>
              <Button size="sm" variant="default" className="bg-cyan-600 hover:bg-cyan-500 text-white gap-1.5">
                Case Workspace
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading && !cases.length && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <Skeleton className="h-[520px] w-full rounded-2xl" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <ErrorState
          title="Orchestration Telemetry Error"
          message={error}
          onRetry={fetchCases}
        />
      )}

      {/* Empty State */}
      {!isLoading && !error && cases.length === 0 && (
        <EmptyState
          icon={Activity}
          title="No Active Orchestration Cases"
          description="There are currently no clinical cases queued or running in the orchestration engine."
          action={{
            label: "Create New Case",
            href: "/cases/new"
          }}
        />
      )}

      {/* Active Case Header Meta */}
      {!isLoading && selectedCase && (
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-mono text-cyan-400 font-semibold">
                CASE #{selectedCase.id.slice(0, 12)}
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-300 font-medium">
                Patient: {selectedCase.patient_name || selectedCase.patient_id}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={selectedCase.priority} />
              <ReviewStateBadge state={selectedCase.review_state || selectedCase.status} />
            </div>
          </div>
        </Card>
      )}

      {/* Orchestration DAG Canvas */}
      {!isLoading && selectedCaseId && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
          <RealtimeOrchestrationGraph
            caseId={selectedCaseId}
            patientId={selectedCase?.patient_id}
            onNavigateToTab={(tab) => {
              navigate(`/cases/${selectedCaseId}?tab=${tab}`);
            }}
          />
        </div>
      )}
    </div>
  );
};
