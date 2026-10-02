import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../services/apiClient';
import { ScreeningReportView } from '../components/screening_report';
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
  FileCheck2,
  ChevronRight,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

export const ScreeningReportsPage: React.FC = () => {
  const { caseId: paramCaseId } = useParams<{ caseId?: string }>();
  const navigate = useNavigate();

  const [cases, setCases] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(paramCaseId || null);
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      if (!selectedCaseId && items.length > 0) {
        setSelectedCaseId(items[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve cases for clinical screening reports.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  useEffect(() => {
    if (selectedCaseId && cases.length > 0) {
      const found = cases.find((c) => c.id === selectedCaseId);
      if (found) setSelectedCase(found);
    }
  }, [selectedCaseId, cases]);

  const handleSelectCase = (id: string) => {
    setSelectedCaseId(id);
    navigate(`/reports/${id}`);
  };

  return (
    <div className="space-y-6">
      {/* Medical Safety Notice */}
      <MedicalSafetyBanner />

      {/* Screen Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7]">
              <FileCheck2 className="w-5 h-5 text-[#8B6F5B]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#3B2A1C]">
                Screening Reports & Summaries
              </h1>
              <p className="text-xs sm:text-sm text-[#6E5D4F]">
                Formal 14-section clinician summary, cross-modal evidence synthesis, and structured sign-off
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Case Selector Dropdown */}
        <div className="flex flex-wrap items-center gap-2.5">
          {cases.length > 0 && (
            <div className="flex items-center gap-2 bg-white border border-[#D9C6B7] rounded-lg px-2.5 py-1.5 text-xs shadow-sm">
              <FolderOpen className="w-3.5 h-3.5 text-[#6E5D4F]" />
              <label htmlFor="report-case-select" className="text-[#6E5D4F] font-medium">
                Active Case:
              </label>
              <select
                id="report-case-select"
                value={selectedCaseId || ''}
                onChange={(e) => handleSelectCase(e.target.value)}
                className="bg-transparent text-[#3B2A1C] font-mono text-xs focus:outline-none cursor-pointer"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white text-[#3B2A1C]">
                    #{c.id.slice(0, 8)} — {c.patient_name || c.patient_id || 'Patient'}
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
            className="border-[#D9C6B7] bg-white text-[#5A4D3B] hover:bg-[#FAF6F0] gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {selectedCaseId && (
            <Link to={`/cases/${selectedCaseId}`}>
              <Button size="sm" variant="default" className="bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white gap-1.5 shadow-sm">
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
          <Skeleton className="h-[600px] w-full rounded-2xl" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <ErrorState
          title="Screening Report Error"
          message={error}
          onRetry={fetchCases}
        />
      )}

      {/* Empty State */}
      {!isLoading && !error && cases.length === 0 && (
        <EmptyState
          icon={FileCheck2}
          title="No Screening Reports Found"
          description="There are currently no cases or screening reports generated."
          action={{
            label: "Create New Case",
            href: "/cases/new"
          }}
        />
      )}

      {/* Case Metadata Banner */}
      {!isLoading && selectedCase && (
        <Card className="p-4 bg-white border-[#D9C6B7] shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[#8B6F5B] font-bold">
                CASE #{selectedCase.id.slice(0, 12)}
              </span>
              <span className="text-[#D9C6B7]">|</span>
              <span className="text-[#3B2A1C] font-medium">
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

      {/* 14-Section Screening Report View Component */}
      {!isLoading && selectedCaseId && (
        <div className="rounded-2xl border border-[#D9C6B7] bg-[#FAF6F0] p-1 sm:p-4 shadow-sm">
          <ScreeningReportView
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

