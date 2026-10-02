import React, { useState, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Printer,
  Download,
  RefreshCw,
  Clock,
  User,
  Activity,
  Layers,
  Sparkles,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileCheck2,
  Send,
  Loader2,
  Lock,
  Stethoscope,
  Info,
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { apiClient } from '../../services/apiClient';
import type {
  ClinicalIntelligenceSummary,
  EvidenceLabelType,
  ScreeningReportSignOffRequest,
} from '../../types/api';

interface ScreeningReportViewProps {
  caseId: string;
  patientId?: string;
  onNavigateToTab?: (tab: string) => void;
}

export const ScreeningReportView: React.FC<ScreeningReportViewProps> = ({
  caseId,
  patientId,
  onNavigateToTab,
}) => {
  const [report, setReport] = useState<ClinicalIntelligenceSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [regenerating, setRegenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sign-off modal / form state
  const [signingOff, setSigningOff] = useState<boolean>(false);
  const [signOffComments, setSignOffComments] = useState<string>('');
  const [signOffDisposition, setSignOffDisposition] = useState<string>('Corroborated with clinical intake presentation');
  const [signOffStatus, setSignOffStatus] = useState<string>('APPROVED');
  const [clinicianSignature, setClinicianSignature] = useState<string>('');
  const [clinicianName, setClinicianName] = useState<string>('');
  const [signOffSuccessMsg, setSignOffSuccessMsg] = useState<string | null>(null);

  // Section collapse state for readability
  const [collapsedSections, setCollapsedSections] = useState<Record<number, boolean>>({});

  const toggleSection = (sectionNum: number) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionNum]: !prev[sectionNum],
    }));
  };

  const fetchReport = async (force: boolean = false) => {
    if (!caseId) return;
    try {
      if (force) setRegenerating(true);
      else setLoading(true);
      setError(null);
      const data = await apiClient.getCaseScreeningReport(caseId, force);
      setReport(data);

      // Pre-fill existing review notes if available
      if (data.review_notes) {
        if (data.review_notes.clinician_comments) setSignOffComments(data.review_notes.clinician_comments);
        if (data.review_notes.diagnostic_disposition) setSignOffDisposition(data.review_notes.diagnostic_disposition);
        if (data.review_notes.clinician_signature) setClinicianSignature(data.review_notes.clinician_signature);
        if (data.review_notes.clinician_name) setClinicianName(data.review_notes.clinician_name);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load screening report';
      setError(msg);
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [caseId]);

  const handleSignOffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicianSignature.trim()) {
      alert('Please provide your digital signature or initials to complete review sign-off.');
      return;
    }
    try {
      setSigningOff(true);
      setSignOffSuccessMsg(null);
      const payload: ScreeningReportSignOffRequest = {
        review_notes: signOffComments.trim() || 'Reviewed and validated clinical screening report.',
        diagnostic_disposition: signOffDisposition,
        sign_off_status: signOffStatus,
        clinician_signature: clinicianSignature.trim(),
        clinician_name: clinicianName.trim() || undefined,
      };
      const updated = await apiClient.signOffScreeningReport(caseId, payload);
      setReport(updated);
      setSignOffSuccessMsg('Physician review sign-off successfully recorded in audit ledger.');
      setTimeout(() => setSignOffSuccessMsg(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to record sign-off');
    } finally {
      setSigningOff(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportMarkdown = () => {
    if (!caseId) return;
    const url = apiClient.exportScreeningReportMarkdownUrl(caseId);
    window.open(url, '_blank');
  };

  const renderEvidenceLabel = (label: EvidenceLabelType) => {
    switch (label) {
      case 'MODEL FINDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-sky-50 text-sky-800 border border-sky-300">
            <Cpu className="w-3 h-3 text-[#8B6F5B]" />
            MODEL FINDING
          </span>
        );
      case 'PATIENT RECORD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300">
            <FileText className="w-3 h-3 text-indigo-400" />
            PATIENT RECORD
          </span>
        );
      case 'TRUSTED KNOWLEDGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-purple-50 text-purple-800 border border-purple-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            TRUSTED KNOWLEDGE
          </span>
        );
      case 'GENERATED SYNTHESIS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-amber-50 text-amber-900 border border-amber-300">
            <Sparkles className="w-3 h-3 text-amber-400" />
            GENERATED SYNTHESIS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#FAF6F0] text-[#5A4D3B] border border-[#D9C6B7]">
            {label}
          </span>
        );
    }
  };

  const getReviewStatusBadge = (status: string) => {
    switch (status) {
      case 'CLEAR':
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold px-2.5 py-0.5">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            CLEAR
          </Badge>
        );
      case 'MODEL_DISAGREEMENT':
        return (
          <Badge className="bg-rose-50 text-rose-800 border-rose-300 font-semibold px-2.5 py-0.5">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            MODEL DISAGREEMENT
          </Badge>
        );
      case 'INSUFFICIENT_EVIDENCE':
        return (
          <Badge className="bg-amber-50 text-amber-900 border-amber-300 font-semibold px-2.5 py-0.5">
            <Clock className="w-3.5 h-3.5 mr-1" />
            INSUFFICIENT EVIDENCE
          </Badge>
        );
      case 'INPUT_QUALITY_ISSUE':
        return (
          <Badge className="bg-orange-50 text-orange-900 border-orange-300 font-semibold px-2.5 py-0.5">
            <ShieldAlert className="w-3.5 h-3.5 mr-1" />
            INPUT QUALITY ISSUE
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-50 text-amber-900 border-amber-300 font-semibold px-2.5 py-0.5">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            REVIEW REQUIRED
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card className="p-12 text-center bg-white border-[#D9C6B7]">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B6F5B] mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-[#3B2A1C]">Compiling 14-Section Screening Report...</h4>
        <p className="text-xs text-[#6E5D4F] mt-1">
          Aggregating patient context, specialized model findings, RAG knowledge, and Gemini grounded synthesis.
        </p>
      </Card>
    );
  }

  if (error || !report) {
    return (
      <Card className="p-8 text-center bg-rose-950/20 border-rose-800/40 space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
        <div>
          <h4 className="text-sm font-semibold text-rose-200">Failed to Load Clinical Screening Report</h4>
          <p className="text-xs text-rose-300/80 mt-1">{error || 'Report data not available'}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchReport(true)}
          className="border-rose-700 bg-rose-950/50 text-rose-200 hover:bg-rose-900"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry Report Compilation
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6 screening-report-container print:space-y-4 print:text-black">
      {/* ============================================================================== */}
      {/* 0. CLINICAL SAFETY ALERT & WORKSTATION ACTION TOOLBAR */}
      {/* ============================================================================== */}
      <div className="bg-[#FCF8F2] p-4 rounded-xl border border-[#D9C6B7] shadow-sm space-y-3 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300 font-mono">
                  Clinical Safety Protocol
                </span>
                <span className="text-[11px] text-amber-400/80 font-mono">• Non-Definitive Screening</span>
              </div>
              <h3 className="text-sm font-bold text-[#3B2A1C] mt-0.5">
                Screening Report & Clinical Intelligence Summary
              </h3>
              <p className="text-xs text-[#5A4D3B]/90 leading-relaxed mt-0.5">
                <strong className="text-amber-200">NOT A FINAL DIAGNOSIS:</strong> This clinical dossier compiles specialized AI screening detections, retrieved patient records, and cross-modal correlations. All findings require licensed physician verification.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs border-[#D9C6B7] bg-white text-[#5A4D3B] hover:bg-[#FAF6F0]"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5 text-[#8B6F5B]" />
              Print Dossier
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportMarkdown}
              className="text-xs border-[#D9C6B7] bg-white text-[#5A4D3B] hover:bg-[#FAF6F0]"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Export Markdown
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchReport(true)}
              disabled={regenerating}
              className="text-xs border-[#D9C6B7] bg-[#F2E4D5] text-[#5A4D3B] hover:bg-[#D9C6B7]"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${regenerating ? 'animate-spin' : ''}`} />
              Recompile
            </Button>
            {onNavigateToTab && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateToTab('evidence-graph')}
                className="text-xs border-[#D9C6B7] bg-white text-[#8B6F5B] hover:bg-[#FAF6F0]"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Evidence Graph
              </Button>
            )}
          </div>
        </div>

        {/* Status Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-500/20 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[#6E5D4F]">
              <strong className="text-[#5A4D3B]">Case:</strong> #{report.case_id.slice(0, 8)}
            </span>
            <span className="text-[#6E5D4F]">•</span>
            <span className="text-[#6E5D4F]">
              <strong className="text-[#5A4D3B]">Review State:</strong>
            </span>
            {getReviewStatusBadge(report.review_status)}
            <span className="text-[#6E5D4F]">•</span>
            <span className="text-[#6E5D4F]">
              <strong className="text-[#5A4D3B]">Uncertainty Level:</strong>{' '}
              <span
                className={`font-semibold ${
                  report.uncertainty_level === 'HIGH'
                    ? 'text-rose-400'
                    : report.uncertainty_level === 'MODERATE'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {report.uncertainty_level}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {report.review_status_details.is_signed_off ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Signed off by {report.review_status_details.signed_by_name || 'Attending Clinician'}
              </span>
            ) : (
              <a
                href="#section-14-signoff"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B6F5B] hover:text-[#8B6F5B] underline"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                Proceed to Clinician Sign-Off & Notes →
              </a>
            )}
          </div>
        </div>
      </div>

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold uppercase">{report.title}</h1>
            <p className="text-xs text-gray-600">CONFIDENTIAL MEDICAL INTELLIGENCE — NOT A FINAL DIAGNOSIS</p>
          </div>
          <div className="text-right text-xs">
            <p><strong>Case ID:</strong> {report.case_id}</p>
            <p><strong>Generated:</strong> {new Date(report.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* SECTION 1: PATIENT CONTEXT */}
      {/* ============================================================================== */}
      <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm print:bg-white print:border-gray-300">
        <div className="flex items-center justify-between border-b border-[#D9C6B7] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center font-mono text-xs font-bold">
              1
            </span>
            <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2 print:text-black">
              <User className="w-4 h-4 text-[#8B6F5B]" />
              Patient Context
            </h3>
          </div>
          <button
            type="button"
            onClick={() => toggleSection(1)}
            className="text-[#6E5D4F] hover:text-[#3B2A1C] print:hidden"
          >
            {collapsedSections[1] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!collapsedSections[1] && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-[#6E5D4F] uppercase tracking-wider text-[10px] font-semibold">Full Name</span>
              <p className="font-semibold text-[#3B2A1C] print:text-black">{report.patient_context.full_name}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[#6E5D4F] uppercase tracking-wider text-[10px] font-semibold">MRN</span>
              <p className="font-mono font-semibold text-[#8B6F5B] print:text-black">
                {report.patient_context.mrn}
                {patientId && <span className="text-[10px] text-[#6E5D4F] block truncate">ID: {patientId.slice(0, 8)}</span>}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[#6E5D4F] uppercase tracking-wider text-[10px] font-semibold">Age / Gender / Blood</span>
              <p className="text-[#5A4D3B] print:text-black">
                {report.patient_context.age ?? 'N/A'} yrs • {report.patient_context.gender ?? 'N/A'} • {report.patient_context.blood_type ?? 'N/A'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[#6E5D4F] uppercase tracking-wider text-[10px] font-semibold">Primary Chronic Condition</span>
              <p className="text-[#5A4D3B] print:text-black">{report.patient_context.primary_condition || 'None documented'}</p>
            </div>

            <div className="col-span-2 space-y-1 pt-2 border-t border-[#D9C6B7]">
              <span className="text-[#6E5D4F] uppercase tracking-wider text-[10px] font-semibold">Documented Allergies</span>
              <div className="flex flex-wrap gap-1.5">
                {report.patient_context.allergies.length > 0 ? (
                  report.patient_context.allergies.map((allg, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/40 text-rose-300 font-medium text-[11px]">
                      {allg}
                    </span>
                  ))
                ) : (
                  <span className="text-[#6E5D4F] italic">No allergies documented</span>
                )}
              </div>
            </div>

            <div className="col-span-2 space-y-1 pt-2 border-t border-[#D9C6B7]">
              <span className="text-[#6E5D4F] uppercase tracking-wider text-[10px] font-semibold">Active Medications</span>
              <div className="flex flex-wrap gap-1.5">
                {report.patient_context.active_medications.length > 0 ? (
                  report.patient_context.active_medications.map((med, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#D9C6B7] text-[#5A4D3B] font-medium text-[11px]">
                      {med}
                    </span>
                  ))
                ) : (
                  <span className="text-[#6E5D4F] italic">No medications listed</span>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* SECTION 2: CASE CONTEXT */}
      {/* ============================================================================== */}
      <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm print:bg-white print:border-gray-300">
        <div className="flex items-center justify-between border-b border-[#D9C6B7] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center font-mono text-xs font-bold">
              2
            </span>
            <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2 print:text-black">
              <FileCheck2 className="w-4 h-4 text-[#8B6F5B]" />
              Case Context & Intake Evaluation
            </h3>
          </div>
          <button
            type="button"
            onClick={() => toggleSection(2)}
            className="text-[#6E5D4F] hover:text-[#3B2A1C] print:hidden"
          >
            {collapsedSections[2] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!collapsedSections[2] && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-[#6E5D4F] uppercase tracking-wider text-[10px] font-semibold">Encounter Title & Priority</span>
              <p className="font-semibold text-[#3B2A1C] print:text-black">
                {report.case_context.title}{' '}
                <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/40 font-mono ml-1">
                  {report.case_context.priority}
                </span>
              </p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <span className="text-[#6E5D4F] uppercase tracking-wider text-[10px] font-semibold">Chief Complaint</span>
              <p className="text-[#5A4D3B] font-medium print:text-black">{report.case_context.chief_complaint}</p>
            </div>

            <div className="space-y-1 md:col-span-3 pt-2 border-t border-[#D9C6B7]">
              <span className="text-[#6E5D4F] uppercase tracking-wider text-[10px] font-semibold">Presenting Symptoms</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {report.case_context.symptoms.map((s, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded-full bg-[#FAF6F0] border border-[#D9C6B7] text-[#5A4D3B] font-medium text-[11px]">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {report.case_context.clinical_notes && (
              <div className="space-y-1 md:col-span-3 pt-2 border-t border-[#D9C6B7]">
                <span className="text-[#6E5D4F] uppercase tracking-wider text-[10px] font-semibold">Intake Clinical Notes</span>
                <p className="text-[#5A4D3B] leading-relaxed bg-[#FCF9F5] p-2.5 rounded border border-[#D9C6B7]">
                  {report.case_context.clinical_notes}
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* SECTION 3: INPUT MODALITIES */}
      {/* ============================================================================== */}
      <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm print:bg-white print:border-gray-300">
        <div className="flex items-center justify-between border-b border-[#D9C6B7] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center font-mono text-xs font-bold">
              3
            </span>
            <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2 print:text-black">
              <Layers className="w-4 h-4 text-[#8B6F5B]" />
              Input Modalities ({report.input_modalities.length} Ingested Assets)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => toggleSection(3)}
            className="text-[#6E5D4F] hover:text-[#3B2A1C] print:hidden"
          >
            {collapsedSections[3] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!collapsedSections[3] && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {report.input_modalities.map((mod) => (
              <div
                key={mod.asset_id}
                className="p-3 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-[#F2E4D5] text-[#8B6F5B] border border-[#D9C6B7]/60">
                    {mod.modality.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {mod.quality_status}
                  </span>
                </div>
                <p className="font-semibold text-[#3B2A1C] truncate">{mod.filename}</p>
                <div className="text-[11px] text-[#6E5D4F] flex items-center justify-between pt-1 border-t border-[#D9C6B7]">
                  <span>{(mod.size_bytes / 1024).toFixed(1)} KB</span>
                  <span className="font-mono text-[10px] text-[#6E5D4F]">
                    {mod.checksum_sha256 ? `${mod.checksum_sha256.slice(0, 8)}...` : 'N/A'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* SECTION 4: SELECTED MODELS */}
      {/* ============================================================================== */}
      <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm print:bg-white print:border-gray-300">
        <div className="flex items-center justify-between border-b border-[#D9C6B7] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center font-mono text-xs font-bold">
              4
            </span>
            <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2 print:text-black">
              <Cpu className="w-4 h-4 text-[#8B6F5B]" />
              Selected AI Models & Calibration Thresholds
            </h3>
          </div>
          <button
            type="button"
            onClick={() => toggleSection(4)}
            className="text-[#6E5D4F] hover:text-[#3B2A1C] print:hidden"
          >
            {collapsedSections[4] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!collapsedSections[4] && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {report.selected_models.map((sm) => (
              <div
                key={sm.model_id}
                className="p-3.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#3B2A1C]">{sm.name}</span>
                  <span className="font-mono text-[10px] text-[#6E5D4F]">v{sm.version}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6E5D4F] pt-1">
                  <div>
                    <span className="text-[#6E5D4F]">Capability:</span>{' '}
                    <span className="text-[#5A4D3B]">{sm.capability}</span>
                  </div>
                  <div>
                    <span className="text-[#6E5D4F]">Threshold:</span>{' '}
                    <span className="font-mono text-[#8B6F5B] font-semibold">{sm.operating_threshold.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[#6E5D4F]">Execution State:</span>{' '}
                    <span className="font-semibold text-emerald-400">{sm.execution_state}</span>
                  </div>
                  <div>
                    <span className="text-[#6E5D4F]">Latency:</span>{' '}
                    <span className="font-mono text-[#5A4D3B]">{sm.runtime_seconds ? `${sm.runtime_seconds.toFixed(2)}s` : '<1s'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* SECTION 5: MODEL FINDINGS (EVIDENCE: MODEL FINDING) */}
      {/* ============================================================================== */}
      <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm print:bg-white print:border-gray-300">
        <div className="flex items-center justify-between border-b border-[#D9C6B7] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center font-mono text-xs font-bold">
              5
            </span>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2 print:text-black">
                <Activity className="w-4 h-4 text-[#8B6F5B]" />
                Model Findings
              </h3>
              {renderEvidenceLabel('MODEL FINDING')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleSection(5)}
            className="text-[#6E5D4F] hover:text-[#3B2A1C] print:hidden"
          >
            {collapsedSections[5] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!collapsedSections[5] && (
          <div className="space-y-2.5">
            {report.model_findings.length === 0 ? (
              <p className="text-xs text-[#6E5D4F] italic p-3 text-center">No specialized model findings recorded.</p>
            ) : (
              report.model_findings.map((finding) => (
                <div
                  key={finding.finding_id}
                  className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    finding.is_positive
                      ? 'bg-rose-950/20 border-rose-800/50'
                      : 'bg-[#FCF9F5] border-[#D9C6B7]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#3B2A1C] text-sm print:text-black">{finding.pathology}</span>
                      {finding.is_positive ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          ⚠️ POSITIVE ({finding.severity.toUpperCase()})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ✓ NORMAL / NEGATIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#6E5D4F]">
                      Model: <span className="text-[#5A4D3B]">{finding.model_name}</span> • Capability: <span className="font-mono text-[#5A4D3B]">{finding.capability}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-4 self-start sm:self-auto shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-[#6E5D4F] block uppercase">Inference Probability</span>
                      <span className={`font-mono text-sm font-bold ${finding.is_positive ? 'text-rose-400' : 'text-[#5A4D3B]'}`}>
                        {(finding.probability * 100).toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-[#6E5D4F] block">Cutoff: {(finding.threshold * 100).toFixed(0)}%</span>
                    </div>

                    <div className="w-20 bg-[#FAF6F0] rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${finding.is_positive ? 'bg-rose-500' : 'bg-slate-600'}`}
                        style={{ width: `${Math.min(100, finding.probability * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* SECTION 6: PATIENT HISTORY (EVIDENCE: PATIENT RECORD) */}
      {/* ============================================================================== */}
      <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm print:bg-white print:border-gray-300">
        <div className="flex items-center justify-between border-b border-[#D9C6B7] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center font-mono text-xs font-bold">
              6
            </span>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2 print:text-black">
                <FileText className="w-4 h-4 text-indigo-400" />
                Patient History & Background Records
              </h3>
              {renderEvidenceLabel('PATIENT RECORD')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleSection(6)}
            className="text-[#6E5D4F] hover:text-[#3B2A1C] print:hidden"
          >
            {collapsedSections[6] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!collapsedSections[6] && (
          <div className="space-y-2 text-xs">
            {report.patient_history.length === 0 ? (
              <p className="text-[#6E5D4F] italic p-2">No historical records indexed for this patient.</p>
            ) : (
              report.patient_history.map((hist) => (
                <div
                  key={hist.record_id}
                  className="p-3 rounded bg-[#FCF9F5] border border-[#D9C6B7] flex items-start gap-3"
                >
                  <span className="px-1.5 py-0.5 rounded font-mono text-[10px] uppercase font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/60 shrink-0">
                    {hist.category.replace('_', ' ')}
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-[#3B2A1C] font-medium">{hist.description}</p>
                    {hist.documented_date && (
                      <span className="text-[10px] text-[#6E5D4F]">Documented: {hist.documented_date}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* SECTION 7: RETRIEVED EVIDENCE (EVIDENCE: PATIENT RECORD / TRUSTED KNOWLEDGE) */}
      {/* ============================================================================== */}
      <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm print:bg-white print:border-gray-300">
        <div className="flex items-center justify-between border-b border-[#D9C6B7] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center font-mono text-xs font-bold">
              7
            </span>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2 print:text-black">
                <Search className="w-4 h-4 text-emerald-400" />
                Retrieved Evidence (PgVector RAG)
              </h3>
              {renderEvidenceLabel('PATIENT RECORD')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleSection(7)}
            className="text-[#6E5D4F] hover:text-[#3B2A1C] print:hidden"
          >
            {collapsedSections[7] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!collapsedSections[7] && (
          <div className="space-y-2.5 text-xs">
            {report.retrieved_evidence.length === 0 ? (
              <p className="text-[#6E5D4F] italic p-2">No prior patient knowledge chunks retrieved.</p>
            ) : (
              report.retrieved_evidence.map((chunk) => (
                <div
                  key={chunk.chunk_id}
                  className="p-3 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#3B2A1C] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#6E5D4F]" />
                      {chunk.document_title}
                      <span className="text-[10px] text-[#6E5D4F] font-mono">
                        (p.{chunk.page_number}, chunk #{chunk.chunk_index})
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                      Similarity: {(chunk.similarity_score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[#5A4D3B] italic bg-[#FAF6F0] p-2 rounded border border-[#D9C6B7]">
                    "{chunk.content_excerpt}"
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* SECTION 8: CROSS-MODAL OBSERVATIONS */}
      {/* ============================================================================== */}
      <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm print:bg-white print:border-gray-300">
        <div className="flex items-center justify-between border-b border-[#D9C6B7] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center font-mono text-xs font-bold">
              8
            </span>
            <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2 print:text-black">
              <Activity className="w-4 h-4 text-[#8B6F5B]" />
              Cross-Modal Observations & Inter-Sensor Correlation
            </h3>
          </div>
          <button
            type="button"
            onClick={() => toggleSection(8)}
            className="text-[#6E5D4F] hover:text-[#3B2A1C] print:hidden"
          >
            {collapsedSections[8] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!collapsedSections[8] && (
          <div className="space-y-2.5 text-xs">
            {report.cross_modal_observations.map((cmo) => (
              <div
                key={cmo.observation_id}
                className="p-3.5 rounded-lg bg-[#FCF9F5] border border-[#D9C6B7] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#3B2A1C] text-sm">{cmo.title}</span>
                  <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-[#F2E4D5] text-[#8B6F5B] border border-[#D9C6B7]/60">
                    {cmo.correlation_type}
                  </span>
                </div>
                <p className="text-[#5A4D3B] leading-relaxed">{cmo.clinical_narrative}</p>
                <div className="text-[10px] text-[#6E5D4F] flex items-center gap-2 pt-1 border-t border-[#D9C6B7]">
                  <span>Involved Modalities:</span>
                  <span className="font-mono text-[#6E5D4F]">{cmo.modalities_involved.join(', ')}</span>
                  <span>• Significance:</span>
                  <span className="font-semibold text-amber-400">{cmo.significance_level}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* SECTION 9: CONFLICTS & DISCREPANCIES */}
      {/* ============================================================================== */}
      <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm print:bg-white print:border-gray-300">
        <div className="flex items-center justify-between border-b border-[#D9C6B7] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center font-mono text-xs font-bold">
              9
            </span>
            <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2 print:text-black">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Conflicts & Discrepancies ({report.conflicts.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => toggleSection(9)}
            className="text-[#6E5D4F] hover:text-[#3B2A1C] print:hidden"
          >
            {collapsedSections[9] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!collapsedSections[9] && (
          <div className="space-y-3 text-xs">
            {report.conflicts.length === 0 ? (
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>No evidentiary conflicts or historical contradictions detected across active data streams.</span>
              </div>
            ) : (
              report.conflicts.map((cnf) => (
                <div
                  key={cnf.conflict_id}
                  className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-500/40 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 font-mono uppercase tracking-wider text-[11px]">
                      {cnf.conflict_type.replace(/_/g, ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      SEVERITY: {cnf.severity}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-[#FAF6F0] border border-[#D9C6B7]">
                      <span className="text-[10px] text-[#6E5D4F] uppercase font-semibold block">{cnf.source_a_label}</span>
                      <p className="text-[#3B2A1C] font-medium mt-0.5">{cnf.source_a_claim}</p>
                    </div>
                    <div className="p-2.5 rounded bg-[#FAF6F0] border border-[#D9C6B7]">
                      <span className="text-[10px] text-[#6E5D4F] uppercase font-semibold block">{cnf.source_b_label}</span>
                      <p className="text-[#3B2A1C] font-medium mt-0.5">{cnf.source_b_claim}</p>
                    </div>
                  </div>

                  <p className="text-[#5A4D3B] text-[11px] leading-relaxed">
                    <strong className="text-amber-200">Clinical Significance:</strong> {cnf.clinical_significance}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* SECTION 10: UNCERTAINTY & DATA GAPS (DO NOT HIDE UNCERTAINTY) */}
      {/* ============================================================================== */}
      <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm print:bg-white print:border-gray-300">
        <div className="flex items-center justify-between border-b border-[#D9C6B7] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center font-mono text-xs font-bold">
              10
            </span>
            <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2 print:text-black">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Clinical Uncertainty & Explicit Data Gaps (Audit Disclosure)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => toggleSection(10)}
            className="text-[#6E5D4F] hover:text-[#3B2A1C] print:hidden"
          >
            {collapsedSections[10] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!collapsedSections[10] && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded bg-[#FAF6F0] border border-[#D9C6B7] space-y-1">
                <span className="text-[10px] text-[#6E5D4F] uppercase font-semibold">Uncertainty Tier</span>
                <p className="text-sm font-bold text-amber-300 font-mono">{report.uncertainty.overall_uncertainty_tier}</p>
                <p className="text-[10px] text-[#6E5D4F]">Based on calibration limits & data completeness</p>
              </div>

              <div className="p-3 rounded bg-[#FAF6F0] border border-[#D9C6B7] space-y-1">
                <span className="text-[10px] text-[#6E5D4F] uppercase font-semibold">Evidence Completeness Ratio</span>
                <p className="text-sm font-bold text-[#8B6F5B] font-mono">
                  {(report.uncertainty.evidence_completeness_ratio * 100).toFixed(0)}%
                </p>
                <div className="w-full bg-[#FAF6F0] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-cyan-500 h-full rounded-full"
                    style={{ width: `${report.uncertainty.evidence_completeness_ratio * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded bg-[#FAF6F0] border border-[#D9C6B7] space-y-1">
                <span className="text-[10px] text-[#6E5D4F] uppercase font-semibold">Missing Standard Modalities</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {report.uncertainty.missing_modalities.length > 0 ? (
                    report.uncertainty.missing_modalities.map((m, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded bg-[#FAF6F0] text-[#5A4D3B] text-[10px] font-mono">
                        {m}
                      </span>
                    ))
                  ) : (
                    <span className="text-emerald-400 font-semibold text-[11px]">All Standard Modalities Present</span>
                  )}
                </div>
              </div>
            </div>

            {/* Calibration & Data Gaps */}
            <div className="p-3 rounded bg-[#FCF9F5] border border-[#D9C6B7] space-y-2">
              <span className="text-[10px] text-[#6E5D4F] uppercase font-semibold tracking-wider block">
                Model Calibration & Boundary Notes
              </span>
              <ul className="list-disc list-inside space-y-1 text-[#5A4D3B] text-[11px]">
                {report.uncertainty.model_calibration_notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded bg-[#FCF9F5] border border-[#D9C6B7] space-y-2">
              <span className="text-[10px] text-[#6E5D4F] uppercase font-semibold tracking-wider block">
                Explicit Clinical Data Gaps
              </span>
              <ul className="list-disc list-inside space-y-1 text-[#5A4D3B] text-[11px]">
                {report.uncertainty.explicit_data_gaps.map((gap, idx) => (
                  <li key={idx}>{gap}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-700/40 text-amber-200/90 text-[11px] leading-relaxed">
              <Info className="w-4 h-4 text-amber-400 inline mr-1.5 mb-0.5" />
              {report.uncertainty.clinical_disclaimer}
            </div>
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* SECTION 11: REVIEW STATUS */}
      {/* ============================================================================== */}
      <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm print:bg-white print:border-gray-300">
        <div className="flex items-center justify-between border-b border-[#D9C6B7] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center font-mono text-xs font-bold">
              11
            </span>
            <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2 print:text-black">
              <Clock className="w-4 h-4 text-[#8B6F5B]" />
              Review Status & Urgency Tier
            </h3>
          </div>
          <button
            type="button"
            onClick={() => toggleSection(11)}
            className="text-[#6E5D4F] hover:text-[#3B2A1C] print:hidden"
          >
            {collapsedSections[11] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!collapsedSections[11] && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-[#6E5D4F] uppercase tracking-wider text-[10px] font-semibold">Review State</span>
              <div>{getReviewStatusBadge(report.review_status_details.review_state)}</div>
            </div>
            <div className="space-y-1">
              <span className="text-[#6E5D4F] uppercase tracking-wider text-[10px] font-semibold">Urgency Classification</span>
              <p className="font-bold text-[#3B2A1C] font-mono uppercase">{report.review_status_details.urgency_tier}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[#6E5D4F] uppercase tracking-wider text-[10px] font-semibold">Specialist Consult Recommended</span>
              <p className="font-semibold text-[#3B2A1C]">
                {report.review_status_details.requires_specialist_consult ? 'YES' : 'NO'}{' '}
                {report.review_status_details.recommended_specialty && (
                  <span className="text-[#8B6F5B] font-normal">({report.review_status_details.recommended_specialty})</span>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[#6E5D4F] uppercase tracking-wider text-[10px] font-semibold">Physician Sign-Off State</span>
              <p className="font-semibold text-[#3B2A1C]">
                {report.review_status_details.is_signed_off ? (
                  <span className="text-emerald-400">APPROVED</span>
                ) : (
                  <span className="text-amber-400">PENDING SIGN-OFF</span>
                )}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* SECTION 12: PROVENANCE */}
      {/* ============================================================================== */}
      <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm print:bg-white print:border-gray-300">
        <div className="flex items-center justify-between border-b border-[#D9C6B7] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center font-mono text-xs font-bold">
              12
            </span>
            <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2 print:text-black">
              <Lock className="w-4 h-4 text-[#8B6F5B]" />
              Cryptographic Provenance Audit Ledger ({report.provenance.length} Verified Traces)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => toggleSection(12)}
            className="text-[#6E5D4F] hover:text-[#3B2A1C] print:hidden"
          >
            {collapsedSections[12] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!collapsedSections[12] && (
          <div className="space-y-2 text-xs">
            {report.provenance.map((trc) => (
              <div
                key={trc.trace_id}
                className="p-2.5 rounded bg-[#FCF9F5] border border-[#D9C6B7] font-mono text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <span className="text-[#8B6F5B] font-semibold">{trc.target_finding}</span>
                  <p className="text-[#6E5D4F] text-[10px]">
                    Origin: {trc.source_origin} • Ref: {trc.asset_reference}
                  </p>
                </div>
                <div className="text-[10px] text-[#6E5D4F] self-start sm:self-auto">
                  <span>SHA-256: </span>
                  <span className="text-[#6E5D4F]">{trc.sha256_verification.slice(0, 16)}...</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* SECTION 13: GENERATED SYNTHESIS (EVIDENCE: GENERATED SYNTHESIS) */}
      {/* ============================================================================== */}
      <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm print:bg-white print:border-gray-300">
        <div className="flex items-center justify-between border-b border-[#D9C6B7] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center font-mono text-xs font-bold">
              13
            </span>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2 print:text-black">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Generated Synthesis & Grounded Clinical Dossier
              </h3>
              {renderEvidenceLabel('GENERATED SYNTHESIS')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleSection(13)}
            className="text-[#6E5D4F] hover:text-[#3B2A1C] print:hidden"
          >
            {collapsedSections[13] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!collapsedSections[13] && (
          <div className="space-y-3.5 text-xs">
            {/* Executive Summary */}
            <div className="p-3.5 rounded-lg bg-[#F2E4D5]/40 border border-[#8B6F5B]/30 space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#8B6F5B] font-mono tracking-wider">
                Executive Clinical Summary
              </span>
              <p className="text-[#3B2A1C] font-medium leading-relaxed">
                {report.generated_synthesis.executive_summary}
              </p>
            </div>

            {/* Detailed Narrative */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-semibold text-[#6E5D4F]">Detailed Evidence Narrative</span>
              <p className="text-[#5A4D3B] leading-relaxed bg-[#FCF9F5] p-3 rounded-lg border border-[#D9C6B7]">
                {report.generated_synthesis.detailed_synthesis}
              </p>
            </div>

            {/* Supporting Evidence IDs */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] pt-1">
              <span className="text-[#6E5D4F]">Supporting Evidence Provenance IDs:</span>
              {report.generated_synthesis.supporting_evidence_ids.length > 0 ? (
                report.generated_synthesis.supporting_evidence_ids.map((id, idx) => (
                  <span key={idx} className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#FAF6F0] text-[#5A4D3B] border border-[#D9C6B7]">
                    {id}
                  </span>
                ))
              ) : (
                <span className="text-[#6E5D4F] italic">No IDs cited</span>
              )}
            </div>

            {/* Targeted Physician Inquiries */}
            {report.generated_synthesis.targeted_physician_questions.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
                  Targeted Physician Review Questions
                </span>
                <ul className="list-disc list-inside space-y-1 text-[#5A4D3B] text-[11px]">
                  {report.generated_synthesis.targeted_physician_questions.map((q, idx) => (
                    <li key={idx}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ============================================================================== */}
      {/* SECTION 14: REVIEW NOTES & ATTENDING CLINICIAN SIGN-OFF */}
      {/* ============================================================================== */}
      <div id="section-14-signoff">
        <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-lg print:bg-white print:border-gray-300">
          <div className="flex items-center justify-between border-b border-[#D9C6B7] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#F2E4D5] text-[#5A4D3B] border border-[#D9C6B7] flex items-center justify-center font-mono text-xs font-bold">
                14
              </span>
              <h3 className="text-sm font-bold text-[#3B2A1C] flex items-center gap-2 print:text-black">
                <Stethoscope className="w-4 h-4 text-[#8B6F5B]" />
                Attending Clinician Review Notes & Formal Sign-Off
              </h3>
            </div>
            <button
              type="button"
              onClick={() => toggleSection(14)}
              className="text-[#6E5D4F] hover:text-[#3B2A1C] print:hidden"
            >
              {collapsedSections[14] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {!collapsedSections[14] && (
            <div className="space-y-4 text-xs">
              {signOffSuccessMsg && (
                <div className="p-3 rounded bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{signOffSuccessMsg}</span>
                </div>
              )}

              {/* Existing Sign-off Details if already recorded */}
              {report.review_notes.clinician_signature && (
                <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Recorded Clinician Sign-Off ({report.review_notes.sign_off_status})
                    </span>
                    <span className="text-[11px] text-[#6E5D4F] font-mono">
                      Signed: {report.review_notes.updated_at ? new Date(report.review_notes.updated_at).toLocaleString() : 'Recent'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-[10px] text-[#6E5D4F] uppercase font-semibold">Attending Clinician</span>
                      <p className="font-semibold text-[#3B2A1C]">{report.review_notes.clinician_name || 'Attending Physician'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#6E5D4F] uppercase font-semibold">Digital Signature</span>
                      <p className="font-mono text-[#8B6F5B] font-semibold">{report.review_notes.clinician_signature}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-[10px] text-[#6E5D4F] uppercase font-semibold">Diagnostic Disposition</span>
                      <p className="text-[#5A4D3B] font-medium">{report.review_notes.diagnostic_disposition || 'N/A'}</p>
                    </div>
                    {report.review_notes.clinician_comments && (
                      <div className="md:col-span-2">
                        <span className="text-[10px] text-[#6E5D4F] uppercase font-semibold">Attending Review Comments</span>
                        <p className="text-[#5A4D3B] mt-0.5 leading-relaxed bg-[#FAF6F0] p-2.5 rounded border border-[#D9C6B7]">
                          {report.review_notes.clinician_comments}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Interactive Sign-off Form */}
              <form onSubmit={handleSignOffSubmit} className="space-y-3 pt-2 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5A4D3B] uppercase tracking-wider mb-1">
                      Clinical Disposition *
                    </label>
                    <select
                      value={signOffDisposition}
                      onChange={(e) => setSignOffDisposition(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                    >
                      <option value="Corroborated with clinical intake presentation">Corroborated with clinical intake presentation</option>
                      <option value="Approved for pulmonary specialist workup">Approved for pulmonary specialist workup</option>
                      <option value="Follow-up high-resolution imaging requested">Follow-up high-resolution imaging requested</option>
                      <option value="Artifact suspected / Borderline probability flagged">Artifact suspected / Borderline probability flagged</option>
                      <option value="Addendum appended for attending rounds">Addendum appended for attending rounds</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#5A4D3B] uppercase tracking-wider mb-1">
                      Sign-Off Status Action
                    </label>
                    <select
                      value={signOffStatus}
                      onChange={(e) => setSignOffStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                    >
                      <option value="APPROVED">APPROVED (Physician Corroboration Confirmed)</option>
                      <option value="REVIEWED">REVIEWED (Secondary Consult Requested)</option>
                      <option value="AMENDED">AMENDED (Addendum Appended)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#5A4D3B] uppercase tracking-wider mb-1">
                    Physician Review Notes & Recommendations
                  </label>
                  <textarea
                    rows={3}
                    value={signOffComments}
                    onChange={(e) => setSignOffComments(e.target.value)}
                    placeholder="Enter clinical assessment, differential observations, or additional orders for patient care..."
                    className="w-full px-3 py-2 rounded bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] placeholder:text-[#6E5D4F] text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5A4D3B] uppercase tracking-wider mb-1">
                      Attending Clinician Name
                    </label>
                    <input
                      type="text"
                      value={clinicianName}
                      onChange={(e) => setClinicianName(e.target.value)}
                      placeholder="Dr. Eleanor Vance, MD"
                      className="w-full px-3 py-2 rounded bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#5A4D3B] uppercase tracking-wider mb-1">
                      Digital Signature / Initials *
                    </label>
                    <input
                      type="text"
                      value={clinicianSignature}
                      onChange={(e) => setClinicianSignature(e.target.value)}
                      placeholder="e.g. EV-MD-88402"
                      required
                      className="w-full px-3 py-2 rounded bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] text-xs font-mono focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={signingOff || !clinicianSignature.trim()}
                    className="bg-[#8B6F5B] hover:bg-[#5A4D3B] text-white font-bold shadow-sm text-xs px-5 py-2"
                  >
                    {signingOff ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Submitting Sign-Off...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        Record Attending Sign-Off
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </Card>
      </div>

      {/* PRINT-ONLY FOOTER */}
      <div className="hidden print:block pt-6 border-t-2 border-slate-900 text-xs text-gray-600">
        <p>MediFusion AI Multimodal Clinical Intelligence Platform • Deterministic 9-Step DAG Architecture</p>
        <p>This automated screening summary is non-diagnostic and must be corroborated with official clinical records.</p>
      </div>
    </div>
  );
};
