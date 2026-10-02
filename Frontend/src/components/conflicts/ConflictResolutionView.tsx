import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/apiClient';
import type { CaseReviewAssessment, StructuredConflictItem } from '../../types/api';
import { ReviewStateBadge } from './ReviewStateBadge';
import { DimensionGauges } from './DimensionGauges';
import { EvidenceComparisonCard } from './EvidenceComparisonCard';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  GitCompare,
  History,
  HelpCircle,
  ImageOff,
} from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface ConflictResolutionViewProps {
  caseId: string;
  patientId?: string;
  onNavigateToTab?: (tab: string) => void;
}

export const ConflictResolutionView: React.FC<ConflictResolutionViewProps> = ({
  caseId,
  patientId,
}) => {
  const [assessment, setAssessment] = useState<CaseReviewAssessment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fixtureLoading, setFixtureLoading] = useState<boolean>(false);

  // Load live assessment
  const fetchAssessment = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiClient.getCaseReviewAssessment(caseId, patientId);
      setAssessment(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load case conflict assessment';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [caseId, patientId]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  // Generate synthetic fixture
  const handleGenerateFixture = async (fixtureType: string) => {
    setFixtureLoading(true);
    setErrorMsg(null);
    try {
      const updated = await apiClient.createSyntheticConflictFixture(caseId, fixtureType, patientId);
      setAssessment(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate synthetic conflict fixture';
      setErrorMsg(msg);
    } finally {
      setFixtureLoading(false);
    }
  };

  // Resolve conflict callback
  const handleResolveConflict = async (conflictId: string, status: string, notes: string) => {
    try {
      await apiClient.resolveConflict(conflictId, status, notes);
      // Re-fetch assessment to update state
      await fetchAssessment();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record conflict resolution';
      setErrorMsg(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* CASE REVIEW STATE HERO BANNER */}
      {/* ========================================================================= */}
      <Card className="p-5 bg-white border-[#D9C6B7] shadow-xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-amber-950/80 text-amber-300 border border-amber-800 text-xs py-0.5">
                PHASE 12
              </Badge>
              {assessment && <ReviewStateBadge state={assessment.review_state} size="md" />}
            </div>

            <h2 className="text-xl font-bold text-[#3B2A1C] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Structured Conflict Detection & Clinician Review Gate
            </h2>

            <p className="text-xs text-[#6E5D4F] max-w-3xl leading-relaxed">
              Automated multi-vector discrepancy screening across specialized AI models, patient records, clinical guidelines, and intake assets. Identifies contradictions and justifies mandatory human review.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAssessment}
              disabled={loading || fixtureLoading}
              className="text-xs border-[#D9C6B7] bg-[#FAF6F0] text-[#3B2A1C]"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Re-evaluate Case
            </Button>
          </div>
        </div>

        {/* Primary Review Reason Banner */}
        {assessment && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              assessment.human_review_required
                ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                : 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
            }`}
          >
            {assessment.human_review_required ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <div className="font-bold text-xs">
                {assessment.human_review_required
                  ? 'Mandatory Clinician Review Required'
                  : 'Case Review State: Concordant & Clear'}
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                {assessment.primary_review_reason}
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* FIVE STRICTLY SEPARATED EVALUATION DIMENSIONS */}
      {/* ========================================================================= */}
      {assessment && <DimensionGauges dimensions={assessment.dimensions} />}

      {/* ========================================================================= */}
      {/* SYNTHETIC CONFLICT TESTING CONTROLS (DEMO / VERIFICATION) */}
      {/* ========================================================================= */}
      <Card className="p-4 bg-white border-[#D9C6B7] space-y-3 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D9C6B7] pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#3B2A1C]">
              Synthetic Conflict Fixture Simulator (Testing & Clinician Adjudication)
            </h3>
          </div>
          <span className="text-[10px] text-[#6E5D4F] font-mono">
            Deterministic Fixtures • Zero Simulated Production Scores
          </span>
        </div>

        <p className="text-[11px] text-[#6E5D4F]">
          Simulate verified conflict scenarios to demonstrate Evidence A vs Evidence B pairwise adjudication:
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={fixtureLoading}
            onClick={() => handleGenerateFixture('model_disagreement')}
            className="text-xs bg-[#FAF6F0] border-rose-800/80 text-rose-300 hover:bg-rose-950"
          >
            <GitCompare className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
            Model Disagreement (DenseNet vs ResNet)
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={fixtureLoading}
            onClick={() => handleGenerateFixture('model_vs_history')}
            className="text-xs bg-[#FAF6F0] border-amber-800/80 text-amber-300 hover:bg-amber-950"
          >
            <History className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
            Model vs Patient History (Cardiomegaly)
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={fixtureLoading}
            onClick={() => handleGenerateFixture('missing_evidence')}
            className="text-xs bg-[#FAF6F0] border-purple-800/80 text-purple-300 hover:bg-purple-950"
          >
            <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
            Missing Evidence (Missing ECG)
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={fixtureLoading}
            onClick={() => handleGenerateFixture('poor_image_quality')}
            className="text-xs bg-[#FAF6F0] border-orange-800/80 text-orange-300 hover:bg-orange-950"
          >
            <ImageOff className="w-3.5 h-3.5 mr-1.5 text-orange-400" />
            Poor Image Quality (Degraded Resolution)
          </Button>

          <Button
            size="sm"
            variant="ghost"
            disabled={fixtureLoading}
            onClick={fetchAssessment}
            className="text-xs text-[#6E5D4F] hover:text-[#3B2A1C]"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Reset to Live Case Data
          </Button>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* STRUCTURED CONFLICTS LIST (EVIDENCE A VERSUS EVIDENCE B) */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#3B2A1C] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Identified Evidentiary Conflicts & Adjudication Ledger ({assessment?.conflicts.length ?? 0})
          </h3>
          <span className="text-xs text-[#6E5D4F]">
            Side-by-side Evidence A vs Evidence B comparisons
          </span>
        </div>

        {assessment?.conflicts && assessment.conflicts.length > 0 ? (
          <div className="space-y-4">
            {assessment.conflicts.map((conflict: StructuredConflictItem) => (
              <EvidenceComparisonCard
                key={conflict.id}
                conflict={conflict}
                onResolve={handleResolveConflict}
              />
            ))}
          </div>
        ) : (
          <Card className="p-8 bg-white border-[#D9C6B7] text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-[#3B2A1C]">Zero Evidentiary Conflicts Detected</h4>
            <p className="text-xs text-[#6E5D4F] max-w-md mx-auto">
              Current specialized model findings, patient baseline records, and clinical intake documentation are completely concordant.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};
