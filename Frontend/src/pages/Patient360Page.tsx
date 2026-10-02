import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/apiClient';
import type {
  PatientRecord,
  PatientSummary,
  ClinicalEvent,
  CaseRecord,
  DocumentRecord,
  ScreeningReportRecord,
} from '../types/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog } from '../components/ui/dialog';
import { CardSkeleton, Skeleton } from '../components/ui/skeleton';
import { ErrorState } from '../components/ui/error-state';
import { MedicalSafetyBanner } from '../components/ui/clinical-badges';
import {
  User,
  ArrowLeft,
  Calendar,
  HeartPulse,
  Activity,
  Droplet,
  Clock,
  FileText,
  BriefcaseMedical,
  ClipboardCheck,
  Plus,
  RefreshCw,
  Stethoscope,
  Microscope,
  Pill,
  Scan,
  FolderPlus,
  FilePlus,
  UploadCloud,
  BrainCircuit,
} from 'lucide-react';
import { PatientKnowledgeView } from '../components/rag';

export const Patient360Page: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'cases' | 'documents' | 'reports' | 'knowledge'>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [timeline, setTimeline] = useState<ClinicalEvent[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [reports, setReports] = useState<ScreeningReportRecord[]>([]);

  // Modals
  const [eventModalOpen, setEventModalOpen] = useState<boolean>(false);
  const [caseModalOpen, setCaseModalOpen] = useState<boolean>(false);
  const [docModalOpen, setDocModalOpen] = useState<boolean>(false);
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);
  const [modalSubmitting, setModalSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form States
  const [eventForm, setEventForm] = useState({
    event_type: 'consultation',
    summary: '',
    notes: '',
  });

  const [caseForm, setCaseForm] = useState({
    title: '',
    chief_complaint: '',
    symptoms: '',
    priority: 'routine',
    clinical_notes: '',
  });

  const [docForm, setDocForm] = useState({
    title: '',
    document_type: 'radiology_report',
    department: 'Radiology',
    author_name: '',
    summary: '',
  });

  const [reportForm, setReportForm] = useState({
    title: '',
    report_type: 'clinical_screening',
    findings_summary: '',
    recommendations: '',
  });

  const loadPatientData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      // Parallel fetch for Patient 360 data
      const [sumRes, timeRes, casesRes, docsRes, repsRes] = await Promise.all([
        apiClient.getPatientSummary(id),
        apiClient.getPatientTimeline(id),
        apiClient.getPatientCases(id),
        apiClient.getPatientDocuments(id),
        apiClient.getPatientReports(id),
      ]);

      setSummary(sumRes);
      setPatient(sumRes.patient);
      setTimeline(timeRes || []);
      setCases(casesRes || []);
      setDocuments(docsRes || []);
      setReports(repsRes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Patient 360 workspace');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPatientData();
  }, [loadPatientData]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setModalSubmitting(true);
    setModalError(null);

    try {
      await apiClient.addTimelineEvent(id, {
        event_type: eventForm.event_type,
        event_date: new Date().toISOString(),
        summary: eventForm.summary,
        metadata: eventForm.notes ? { clinical_notes: eventForm.notes } : {},
      });
      setEventModalOpen(false);
      setEventForm({ event_type: 'consultation', summary: '', notes: '' });
      await loadPatientData();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to add timeline event');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleAddCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setModalSubmitting(true);
    setModalError(null);

    try {
      await apiClient.createPatientCase(id, {
        title: caseForm.title,
        chief_complaint: caseForm.chief_complaint,
        symptoms: caseForm.symptoms.split(',').map((s) => s.trim()).filter(Boolean),
        priority: caseForm.priority as 'routine' | 'urgent' | 'stat',
        clinical_notes: caseForm.clinical_notes || undefined,
      });
      setCaseModalOpen(false);
      setCaseForm({ title: '', chief_complaint: '', symptoms: '', priority: 'routine', clinical_notes: '' });
      await loadPatientData();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to create case');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setModalSubmitting(true);
    setModalError(null);

    try {
      await apiClient.addPatientDocument(id, {
        title: docForm.title,
        document_type: docForm.document_type,
        document_date: new Date().toISOString().split('T')[0],
        department: docForm.department,
        author_name: docForm.author_name || undefined,
        summary: docForm.summary || undefined,
      });
      setDocModalOpen(false);
      setDocForm({ title: '', document_type: 'radiology_report', department: 'Radiology', author_name: '', summary: '' });
      await loadPatientData();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to add document');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleAddReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setModalSubmitting(true);
    setModalError(null);

    try {
      await apiClient.addPatientReport(id, {
        title: reportForm.title,
        report_type: reportForm.report_type,
        findings_summary: reportForm.findings_summary || undefined,
        recommendations: reportForm.recommendations || undefined,
      });
      setReportModalOpen(false);
      setReportForm({ title: '', report_type: 'clinical_screening', findings_summary: '', recommendations: '' });
      await loadPatientData();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to create report');
    } finally {
      setModalSubmitting(false);
    }
  };

  const calculateAge = (dobString?: string): number => {
    if (!dobString) return 0;
    const dob = new Date(dobString);
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'consultation':
        return <Stethoscope className="h-4 w-4 text-[#8B6F5B]" />;
      case 'lab_result':
        return <Microscope className="h-4 w-4 text-amber-600" />;
      case 'imaging':
        return <Scan className="h-4 w-4 text-emerald-600" />;
      case 'prescription':
        return <Pill className="h-4 w-4 text-[#5A4D3B]" />;
      default:
        return <Activity className="h-4 w-4 text-rose-600" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading Patient 360 data">
        <MedicalSafetyBanner />
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-8 w-20" />
        </div>
        <CardSkeleton className="h-44" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="space-y-6 my-6">
        <MedicalSafetyBanner />
        <ErrorState
          title="Patient 360 Record Unavailable"
          message={error || 'The requested patient record could not be found or retrieved from the database.'}
          onRetry={loadPatientData}
        />
        <div className="flex justify-center">
          <Button size="sm" variant="outline" onClick={() => navigate('/patients')}>
            Return to Patient Directory
          </Button>
        </div>
      </div>
    );
  }

  const age = calculateAge(patient.date_of_birth);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Medical Safety Notice */}
      <MedicalSafetyBanner />
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/patients"
          className="inline-flex items-center gap-1.5 text-xs text-[#6E5D4F] hover:text-[#3B2A1C] font-medium transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Patient Directory</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadPatientData} className="h-8 gap-1 text-xs">
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Patient Header Card */}
      <Card className="border-[#D9C6B7] bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Identity and Demographics */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F2E4D5] border border-[#D9C6B7] text-[#8B6F5B] shadow-sm">
                <User className="h-7 w-7" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#3B2A1C]">
                    {patient.first_name} {patient.last_name}
                  </h1>
                  <Badge variant="outline" className="font-mono text-xs text-[#5A4D3B] border-[#D9C6B7] bg-[#FAF6F0]">
                    {patient.mrn}
                  </Badge>
                  {patient.blood_type && (
                    <Badge variant="secondary" className="font-mono text-xs text-emerald-800 bg-emerald-50 border border-emerald-200">
                      <Droplet className="h-3 w-3 mr-1 text-emerald-700" />
                      {patient.blood_type}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E5D4F] mt-1.5 font-medium">
                  <span>{patient.gender}</span>
                  <span>•</span>
                  <span>{age} years old</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-[#8B6F5B]" />
                    DOB: {patient.date_of_birth}
                  </span>
                </div>

                {/* Risk / Clinical Flags */}
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[#D9C6B7]/60">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Activity className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                    <span className="text-[#3B2A1C] font-semibold">Allergies:</span>
                    {patient.allergies && patient.allergies.length > 0 ? (
                      patient.allergies.map((a) => (
                        <Badge key={a} variant="destructive" className="text-[10px] py-0 px-1.5">
                          {a}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[#8B6F5B]">None</span>
                    )}
                  </div>

                  <span className="text-[#D9C6B7] hidden sm:inline">•</span>

                  <div className="flex items-center gap-1.5 text-[11px]">
                    <HeartPulse className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span className="text-[#3B2A1C] font-semibold">Conditions:</span>
                    {patient.chronic_conditions && patient.chronic_conditions.length > 0 ? (
                      patient.chronic_conditions.map((c) => (
                        <Badge key={c} variant="warning" className="text-[10px] py-0 px-1.5">
                          {c}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[#8B6F5B]">None</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Quick Action Buttons */}
            <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
              <Button size="sm" onClick={() => setCaseModalOpen(true)} className="gap-1.5 text-xs">
                <FolderPlus className="h-3.5 w-3.5" />
                <span>Create Case</span>
              </Button>

              <Button size="sm" variant="outline" onClick={() => setEventModalOpen(true)} className="gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5 text-[#8B6F5B]" />
                <span>Log Timeline Event</span>
              </Button>

              <Button size="sm" variant="outline" onClick={() => setDocModalOpen(true)} className="gap-1.5 text-xs">
                <FilePlus className="h-3.5 w-3.5 text-emerald-700" />
                <span>Add Document</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patient 360 Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#D9C6B7] overflow-x-auto pb-1 text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[#F2E4D5] text-[#3B2A1C] font-semibold border-b-2 border-[#8B6F5B]'
              : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'timeline'
              ? 'bg-[#F2E4D5] text-[#3B2A1C] font-semibold border-b-2 border-[#8B6F5B]'
              : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Timeline ({timeline.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cases')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'cases'
              ? 'bg-[#F2E4D5] text-[#3B2A1C] font-semibold border-b-2 border-[#8B6F5B]'
              : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
          }`}
        >
          <BriefcaseMedical className="h-4 w-4" />
          <span>Cases ({cases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'documents'
              ? 'bg-[#F2E4D5] text-[#3B2A1C] font-semibold border-b-2 border-[#8B6F5B]'
              : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Documents ({documents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-[#F2E4D5] text-[#3B2A1C] font-semibold border-b-2 border-[#8B6F5B]'
              : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
          <span>Reports ({reports.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('knowledge')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'knowledge'
              ? 'bg-[#F2E4D5] text-[#8B6F5B] font-semibold border-b-2 border-[#8B6F5B]'
              : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
          }`}
        >
          <BrainCircuit className="h-4 w-4 text-[#8B6F5B]" />
          <span>Patient Knowledge & RAG</span>
        </button>
      </div>

      {/* TAB CONTENT: 1. OVERVIEW */}
      {activeTab === 'overview' && summary && (
        <div className="space-y-6">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-[#D9C6B7] bg-white p-4 shadow-sm">
              <span className="text-xs text-[#6E5D4F] flex items-center gap-1.5 font-medium">
                <BriefcaseMedical className="h-3.5 w-3.5 text-[#8B6F5B]" />
                Active Cases
              </span>
              <span className="text-2xl font-bold font-mono text-[#3B2A1C] mt-1 block">
                {summary.total_cases}
              </span>
            </Card>

            <Card className="border-[#D9C6B7] bg-white p-4 shadow-sm">
              <span className="text-xs text-[#6E5D4F] flex items-center gap-1.5 font-medium">
                <Clock className="h-3.5 w-3.5 text-[#8B6F5B]" />
                Timeline Events
              </span>
              <span className="text-2xl font-bold font-mono text-[#3B2A1C] mt-1 block">
                {summary.total_events}
              </span>
            </Card>

            <Card className="border-[#D9C6B7] bg-white p-4 shadow-sm">
              <span className="text-xs text-[#6E5D4F] flex items-center gap-1.5 font-medium">
                <FileText className="h-3.5 w-3.5 text-[#8B6F5B]" />
                Clinical Documents
              </span>
              <span className="text-2xl font-bold font-mono text-[#3B2A1C] mt-1 block">
                {summary.total_documents}
              </span>
            </Card>

            <Card className="border-[#D9C6B7] bg-white p-4 shadow-sm">
              <span className="text-xs text-[#6E5D4F] flex items-center gap-1.5 font-medium">
                <ClipboardCheck className="h-3.5 w-3.5 text-[#8B6F5B]" />
                Screening Reports
              </span>
              <span className="text-2xl font-bold font-mono text-[#3B2A1C] mt-1 block">
                {summary.total_reports}
              </span>
            </Card>
          </div>

          {/* Quick Previews: Timeline & Cases */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Timeline Preview */}
            <Card className="border-[#D9C6B7] bg-white shadow-sm">
              <CardHeader className="pb-3 border-b border-[#D9C6B7]/60">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2 text-[#3B2A1C]">
                    <Clock className="h-4 w-4 text-[#8B6F5B]" />
                    Recent Longitudinal Timeline
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setActiveTab('timeline')} className="text-xs text-[#8B6F5B] hover:text-[#5A4D3B]">
                    View All ({timeline.length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-3">
                {timeline.length === 0 ? (
                  <p className="text-xs text-[#8B6F5B] py-4 text-center">No timeline encounters logged yet.</p>
                ) : (
                  timeline.slice(0, 3).map((event) => (
                    <div key={event.id} className="flex items-start gap-3 rounded-lg border border-[#D9C6B7]/60 bg-[#FAF6F0] p-3 text-xs">
                      <div className="mt-0.5 rounded-md bg-[#F2E4D5] p-1.5 border border-[#D9C6B7]">
                        {getEventIcon(event.event_type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#3B2A1C] capitalize">{event.event_type.replace('_', ' ')}</span>
                          <span className="text-[11px] text-[#6E5D4F] font-mono">
                            {new Date(event.event_date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[#5A4D3B] mt-0.5">{event.summary}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Cases Preview */}
            <Card className="border-[#D9C6B7] bg-white shadow-sm">
              <CardHeader className="pb-3 border-b border-[#D9C6B7]/60">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2 text-[#3B2A1C]">
                    <BriefcaseMedical className="h-4 w-4 text-[#8B6F5B]" />
                    Clinical Cases
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setActiveTab('cases')} className="text-xs text-[#8B6F5B] hover:text-[#5A4D3B]">
                    View All ({cases.length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-3">
                {cases.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-[#8B6F5B] mb-2">No clinical cases created for this patient.</p>
                    <Button size="sm" onClick={() => setCaseModalOpen(true)} className="gap-1.5 text-xs">
                      <Plus className="h-3.5 w-3.5" />
                      Create First Case
                    </Button>
                  </div>
                ) : (
                  cases.slice(0, 3).map((c) => (
                    <div key={c.id} className="rounded-lg border border-[#D9C6B7]/60 bg-[#FAF6F0] p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[#5A4D3B] font-semibold">{c.case_number}</span>
                        <Badge variant={c.priority === 'urgent' ? 'warning' : c.priority === 'stat' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {c.priority.toUpperCase()}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-[#3B2A1C] mt-1">{c.title}</h4>
                      <p className="text-[#6E5D4F] text-[11px] line-clamp-1 mt-0.5">{c.chief_complaint}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 2. TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#3B2A1C] flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#8B6F5B]" />
                Longitudinal Patient Timeline
              </h3>
              <p className="text-xs text-[#6E5D4F]">
                Chronological sequence of clinical consultations, diagnostic imaging, laboratory findings, and prescriptions.
              </p>
            </div>
            <Button size="sm" onClick={() => setEventModalOpen(true)} className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Add Event
            </Button>
          </div>

          {timeline.length === 0 ? (
            <Card className="border-[#D9C6B7] bg-white p-8 text-center shadow-sm">
              <Clock className="h-10 w-10 text-[#8B6F5B]/50 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-[#3B2A1C]">No Timeline Encounters Yet</h4>
              <p className="text-xs text-[#6E5D4F] mt-1 max-w-sm mx-auto">
                Log diagnostic observations, consultations, or medications to establish this patient's longitudinal history.
              </p>
              <Button size="sm" onClick={() => setEventModalOpen(true)} className="mt-4 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Log Event
              </Button>
            </Card>
          ) : (
            <div className="relative border-l border-[#D9C6B7] ml-4 pl-6 space-y-6">
              {timeline.map((event) => (
                <div key={event.id} className="relative group">
                  {/* Timeline bullet icon */}
                  <div className="absolute -left-[37px] top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#FAF6F0] border border-[#D9C6B7] shadow-sm">
                    {getEventIcon(event.event_type)}
                  </div>

                  <Card className="border-[#D9C6B7]/80 bg-white p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#D9C6B7]/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#3B2A1C] capitalize">
                          {event.event_type.replace('_', ' ')}
                        </span>
                        <Badge variant="outline" className="text-[10px] text-[#5A4D3B] border-[#D9C6B7] bg-[#FAF6F0]">
                          Encounter
                        </Badge>
                      </div>
                      <span className="font-mono text-xs text-[#6E5D4F] flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-[#8B6F5B]" />
                        {new Date(event.event_date).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-[#3B2A1C] mt-2 font-medium">{event.summary}</p>

                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div className="mt-2.5 rounded-md bg-[#FAF6F0] p-2.5 text-[11px] text-[#5A4D3B] border border-[#D9C6B7]/60">
                        {Boolean(event.metadata?.clinical_notes) && (
                          <p>
                            <strong className="text-[#3B2A1C]">Clinician Notes:</strong> {String(event.metadata?.clinical_notes)}
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: 3. CASES */}
      {activeTab === 'cases' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#3B2A1C] flex items-center gap-2">
                <BriefcaseMedical className="h-5 w-5 text-[#8B6F5B]" />
                Patient Cases ({cases.length})
              </h3>
              <p className="text-xs text-[#6E5D4F]">
                Multimodal screening cases and clinical decision support workspaces.
              </p>
            </div>
            <Button size="sm" onClick={() => setCaseModalOpen(true)} className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              New Case
            </Button>
          </div>

          {cases.length === 0 ? (
            <Card className="border-[#D9C6B7] bg-white p-8 text-center shadow-sm">
              <BriefcaseMedical className="h-10 w-10 text-[#8B6F5B]/50 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-[#3B2A1C]">No Cases Recorded</h4>
              <p className="text-xs text-[#6E5D4F] mt-1 max-w-sm mx-auto">
                Create a case to begin multimodal asset ingestion and clinical screening.
              </p>
              <Button size="sm" onClick={() => setCaseModalOpen(true)} className="mt-4 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Create Case
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cases.map((c) => (
                <Card key={c.id} className="border-[#D9C6B7] bg-white p-4 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="font-mono text-[10px] text-[#5A4D3B] border-[#D9C6B7] bg-[#FAF6F0]">
                        {c.case_number}
                      </Badge>
                      <h4 className="text-base font-bold text-[#3B2A1C] mt-1">{c.title}</h4>
                    </div>
                    <Badge variant={c.priority === 'urgent' ? 'warning' : c.priority === 'stat' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {c.priority.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="text-xs space-y-1.5">
                    <div>
                      <span className="text-[#3B2A1C] font-semibold">Chief Complaint:</span>
                      <p className="text-[#5A4D3B] mt-0.5">{c.chief_complaint}</p>
                    </div>

                    {c.symptoms && c.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {c.symptoms.map((s) => (
                          <Badge key={s} variant="secondary" className="text-[10px]">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-[#D9C6B7]/60 pt-2.5 text-[11px] text-[#6E5D4F]">
                    <span>Status: <strong className="text-[#3B2A1C] uppercase">{c.status}</strong></span>
                    <span>Created: {new Date(c.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="pt-1">
                    <Link
                      to={`/cases/${c.id}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F2E4D5] hover:bg-[#EAE1D7] border border-[#D9C6B7] text-[#3B2A1C] text-xs font-semibold transition-colors"
                    >
                      <UploadCloud className="h-3.5 w-3.5 text-[#8B6F5B]" />
                      Open Multimodal Intake Workspace
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: 4. DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#3B2A1C] flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#8B6F5B]" />
                Clinical Documents ({documents.length})
              </h3>
              <p className="text-xs text-[#6E5D4F]">
                Historical medical documents, specialist referral letters, and laboratory summaries.
              </p>
            </div>
            <Button size="sm" onClick={() => setDocModalOpen(true)} className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Add Document
            </Button>
          </div>

          {documents.length === 0 ? (
            <Card className="border-[#D9C6B7] bg-white p-8 text-center shadow-sm">
              <FileText className="h-10 w-10 text-[#8B6F5B]/50 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-[#3B2A1C]">No Documents Uploaded</h4>
              <p className="text-xs text-[#6E5D4F] mt-1 max-w-sm mx-auto">
                Add clinical reports or discharge summaries to enable historical RAG and context fusion.
              </p>
              <Button size="sm" onClick={() => setDocModalOpen(true)} className="mt-4 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add Document
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <Card key={doc.id} className="border-[#D9C6B7] bg-white p-4 space-y-2.5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="text-[10px] text-emerald-800 border-emerald-200 bg-emerald-50">
                        {doc.document_type.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <h4 className="text-sm font-bold text-[#3B2A1C] mt-1">{doc.title}</h4>
                    </div>
                    <span className="font-mono text-xs text-[#6E5D4F]">{doc.document_date}</span>
                  </div>

                  <div className="text-xs text-[#6E5D4F] flex items-center gap-2">
                    <span>Dept: <strong className="text-[#3B2A1C]">{doc.department || 'General'}</strong></span>
                    {doc.author_name && (
                      <>
                        <span>•</span>
                        <span>Author: <strong className="text-[#3B2A1C]">{doc.author_name}</strong></span>
                      </>
                    )}
                  </div>

                  {doc.summary && (
                    <p className="text-xs text-[#5A4D3B] bg-[#FAF6F0] p-2.5 rounded border border-[#D9C6B7]/60">
                      {doc.summary}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: 5. REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#3B2A1C] flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-[#8B6F5B]" />
                Screening Reports ({reports.length})
              </h3>
              <p className="text-xs text-[#6E5D4F]">
                Clinician-reviewed multimodal screening reports and decision-support records.
              </p>
            </div>
            <Button size="sm" onClick={() => setReportModalOpen(true)} className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Draft Report
            </Button>
          </div>

          {reports.length === 0 ? (
            <Card className="border-[#D9C6B7] bg-white p-8 text-center shadow-sm">
              <ClipboardCheck className="h-10 w-10 text-[#8B6F5B]/50 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-[#3B2A1C]">No Screening Reports Yet</h4>
              <p className="text-xs text-[#6E5D4F] mt-1 max-w-sm mx-auto">
                Preliminary screening reports generated during case analysis will appear here.
              </p>
              <Button size="sm" onClick={() => setReportModalOpen(true)} className="mt-4 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Draft Report
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {reports.map((rep) => (
                <Card key={rep.id} className="border-[#D9C6B7] bg-white p-5 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] text-[#5A4D3B] border-[#D9C6B7] bg-[#FAF6F0]">
                          {rep.report_type.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <Badge variant={rep.status === 'final' ? 'success' : 'secondary'} className="text-[10px]">
                          {rep.status.toUpperCase()}
                        </Badge>
                      </div>
                      <h4 className="text-base font-bold text-[#3B2A1C] mt-1.5">{rep.title}</h4>
                    </div>
                    <span className="font-mono text-xs text-[#6E5D4F]">
                      {new Date(rep.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {rep.findings_summary && (
                    <div className="text-xs space-y-1">
                      <span className="font-semibold text-[#3B2A1C]">Findings Summary:</span>
                      <p className="text-[#5A4D3B] bg-[#FAF6F0] p-3 rounded border border-[#D9C6B7]/60">
                        {rep.findings_summary}
                      </p>
                    </div>
                  )}

                  {rep.recommendations && (
                    <div className="text-xs space-y-1">
                      <span className="font-semibold text-[#3B2A1C]">Recommendations:</span>
                      <p className="text-[#6E5D4F]">{rep.recommendations}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: 6. PATIENT KNOWLEDGE & RAG EVIDENCE */}
      {activeTab === 'knowledge' && id && (
        <div className="space-y-6">
          <PatientKnowledgeView
            patientId={id}
            patientName={patient ? `${patient.first_name} ${patient.last_name}` : undefined}
          />
        </div>
      )}

      {/* MODAL: ADD TIMELINE EVENT */}
      <Dialog
        open={eventModalOpen}
        onOpenChange={setEventModalOpen}
        title="Record Clinical Timeline Encounter"
        description="Log a consultation, diagnostic imaging study, laboratory test, or medication."
      >
        <form onSubmit={handleAddEvent} className="space-y-3 text-xs">
          {modalError && <div className="p-2 rounded bg-rose-50 text-rose-700 border border-rose-200">{modalError}</div>}
          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Event Type</label>
            <select
              value={eventForm.event_type}
              onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            >
              <option value="consultation">Consultation / Encounter</option>
              <option value="imaging">Diagnostic Imaging (X-Ray, MRI, CT)</option>
              <option value="lab_result">Laboratory / Pathology Test</option>
              <option value="prescription">Prescription / Medication Change</option>
              <option value="diagnosis">Clinical Diagnosis / Problem Update</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Encounter Summary</label>
            <input
              type="text"
              required
              value={eventForm.summary}
              onChange={(e) => setEventForm({ ...eventForm, summary: e.target.value })}
              placeholder="e.g. Chest discomfort post-exertion, ECG ordered"
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Clinician Notes (Optional)</label>
            <textarea
              rows={3}
              value={eventForm.notes}
              onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
              placeholder="Detailed physical exam findings, vital signs, or observations..."
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#D9C6B7]">
            <Button type="button" variant="outline" onClick={() => setEventModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={modalSubmitting}>
              {modalSubmitting ? 'Logging...' : 'Save Encounter'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL: CREATE CASE */}
      <Dialog
        open={caseModalOpen}
        onOpenChange={setCaseModalOpen}
        title="Create Multimodal Screening Case"
        description="Initiate a clinical screening case with symptoms and priority."
      >
        <form onSubmit={handleAddCase} className="space-y-3 text-xs">
          {modalError && <div className="p-2 rounded bg-rose-50 text-rose-700 border border-rose-200">{modalError}</div>}
          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Case Title</label>
            <input
              type="text"
              required
              value={caseForm.title}
              onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value })}
              placeholder="e.g. Acute Chest Pain & Shortness of Breath"
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Chief Complaint</label>
            <input
              type="text"
              required
              value={caseForm.chief_complaint}
              onChange={(e) => setCaseForm({ ...caseForm, chief_complaint: e.target.value })}
              placeholder="Primary reason for clinical intake"
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[#3B2A1C] font-semibold">Symptoms (comma-separated)</label>
              <input
                type="text"
                value={caseForm.symptoms}
                onChange={(e) => setCaseForm({ ...caseForm, symptoms: e.target.value })}
                placeholder="cough, fever, dyspnea"
                className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[#3B2A1C] font-semibold">Priority</label>
              <select
                value={caseForm.priority}
                onChange={(e) => setCaseForm({ ...caseForm, priority: e.target.value })}
                className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT / Emergency</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Clinical Notes</label>
            <textarea
              rows={2}
              value={caseForm.clinical_notes}
              onChange={(e) => setCaseForm({ ...caseForm, clinical_notes: e.target.value })}
              placeholder="Initial intake remarks..."
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#D9C6B7]">
            <Button type="button" variant="outline" onClick={() => setCaseModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={modalSubmitting}>
              {modalSubmitting ? 'Creating...' : 'Create Case'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL: ADD DOCUMENT */}
      <Dialog
        open={docModalOpen}
        onOpenChange={setDocModalOpen}
        title="Add Clinical Document / Report"
        description="Store historical clinical document for patient records."
      >
        <form onSubmit={handleAddDoc} className="space-y-3 text-xs">
          {modalError && <div className="p-2 rounded bg-rose-50 text-rose-700 border border-rose-200">{modalError}</div>}
          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Document Title</label>
            <input
              type="text"
              required
              value={docForm.title}
              onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
              placeholder="e.g. Chest X-Ray Radiology Report"
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[#3B2A1C] font-semibold">Document Type</label>
              <select
                value={docForm.document_type}
                onChange={(e) => setDocForm({ ...docForm, document_type: e.target.value })}
                className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
              >
                <option value="radiology_report">Radiology Report</option>
                <option value="lab_report">Lab / Pathology Report</option>
                <option value="discharge_summary">Discharge Summary</option>
                <option value="clinical_note">Clinical Note</option>
                <option value="prescription">Prescription</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[#3B2A1C] font-semibold">Department</label>
              <input
                type="text"
                value={docForm.department}
                onChange={(e) => setDocForm({ ...docForm, department: e.target.value })}
                className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Authoring Clinician / Lab</label>
            <input
              type="text"
              value={docForm.author_name}
              onChange={(e) => setDocForm({ ...docForm, author_name: e.target.value })}
              placeholder="Dr. Gregory House, MD"
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Document Summary / Impression</label>
            <textarea
              rows={3}
              value={docForm.summary}
              onChange={(e) => setDocForm({ ...docForm, summary: e.target.value })}
              placeholder="Impression: Clear lung fields, no pneumothorax or pleural effusion..."
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#D9C6B7]">
            <Button type="button" variant="outline" onClick={() => setDocModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={modalSubmitting}>
              {modalSubmitting ? 'Saving...' : 'Add Document'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL: DRAFT REPORT */}
      <Dialog
        open={reportModalOpen}
        onOpenChange={setReportModalOpen}
        title="Draft Screening Report"
        description="Record initial clinical screening observations."
      >
        <form onSubmit={handleAddReport} className="space-y-3 text-xs">
          {modalError && <div className="p-2 rounded bg-rose-50 text-rose-700 border border-rose-200">{modalError}</div>}
          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Report Title</label>
            <input
              type="text"
              required
              value={reportForm.title}
              onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
              placeholder="e.g. Multimodal Cardiopulmonary Screening Summary"
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Findings Summary</label>
            <textarea
              rows={3}
              value={reportForm.findings_summary}
              onChange={(e) => setReportForm({ ...reportForm, findings_summary: e.target.value })}
              placeholder="Correlated ECG and chest X-ray findings..."
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[#3B2A1C] font-semibold">Recommendations</label>
            <textarea
              rows={2}
              value={reportForm.recommendations}
              onChange={(e) => setReportForm({ ...reportForm, recommendations: e.target.value })}
              placeholder="Recommendations for treating team..."
              className="w-full rounded-md border border-[#D9C6B7] bg-[#FAF6F0] p-2 text-[#3B2A1C] placeholder-[#8B6F5B]/50 focus:border-[#8B6F5B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#D9C6B7]">
            <Button type="button" variant="outline" onClick={() => setReportModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={modalSubmitting}>
              {modalSubmitting ? 'Saving...' : 'Save Draft Report'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
