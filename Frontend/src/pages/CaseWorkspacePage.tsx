import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../services/apiClient';
import type { CaseDetailRecord, MedicalAsset, ModalityType } from '../types/api';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ModelRunView } from '../components/models';
import { OrchestrationPlanView } from '../components/orchestration';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Brain,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  GitBranch,
  Hash,
  Info,
  Loader2,
  Pill,
  RefreshCw,
  Scan,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UploadCloud,
  BrainCircuit,
  Sparkles,
  Layers,
  AlertTriangle,
  Network,
  GitGraph,
} from 'lucide-react';
import { PatientKnowledgeView } from '../components/rag';
import { GeminiEvidenceView } from '../components/gemini';
import { CanonicalEvidenceExplorer } from '../components/evidence';
import { ConflictResolutionView } from '../components/conflicts';
import { RealtimeOrchestrationGraph } from '../components/orchestration_graph';
import { InteractiveEvidenceGraph } from '../components/evidence_graph';
import { ScreeningReportView } from '../components/screening_report';
import { ModelCouncilView } from '../components/council/ModelCouncilView';
import { EvidenceSensitivityView } from '../components/sensitivity/EvidenceSensitivityView';
import { ImagingExplainabilityView } from '../components/explainability/ImagingExplainabilityView';
import { ResourceDashboardWidget } from '../components/orchestration/ResourceDashboardWidget';
import { Users, Scale } from 'lucide-react';

interface ModalityOption {
  type: ModalityType;
  label: string;
  category: 'imaging' | 'biosignal' | 'document';
  description: string;
  accept: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const MODALITY_OPTIONS: ModalityOption[] = [
  {
    type: 'chest_xray',
    label: 'Chest X-Ray',
    category: 'imaging',
    description: 'PA / AP projection radiographs (PNG, JPEG, DICOM)',
    accept: '.png,.jpg,.jpeg,.dcm',
    icon: Scan,
    color: 'text-[#3B2A1C] bg-[#FAF6F0] border-[#D9C6B7]',
  },
  {
    type: 'ecg',
    label: 'ECG Signal',
    category: 'biosignal',
    description: '12-lead rhythm data (CSV, XML, JSON, PDF, Image)',
    accept: '.csv,.json,.xml,.pdf,.png,.jpg,.txt,.dat',
    icon: Activity,
    color: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  },
  {
    type: 'pdf_report',
    label: 'PDF Lab Report',
    category: 'document',
    description: 'Clinical laboratory panels, pathology, hematology (PDF)',
    accept: '.pdf',
    icon: FileText,
    color: 'text-[#5A4D3B] bg-[#FAF6F0] border-[#D9C6B7]',
  },
  {
    type: 'clinical_note',
    label: 'Clinical Note',
    category: 'document',
    description: 'Physician intake notes, triage documentation (TXT, PDF, MD)',
    accept: '.txt,.pdf,.md,.doc,.docx',
    icon: Stethoscope,
    color: 'text-amber-800 bg-amber-50 border-amber-200',
  },
  {
    type: 'mri',
    label: 'Brain / Neuro MRI',
    category: 'imaging',
    description: 'T1, T2, FLAIR scans (DICOM, NIfTI, PNG, JPEG)',
    accept: '.dcm,.nii,.gz,.png,.jpg,.jpeg',
    icon: Brain,
    color: 'text-[#5A4D3B] bg-[#FAF6F0] border-[#D9C6B7]',
  },
  {
    type: 'ct',
    label: 'Head / Torso CT',
    category: 'imaging',
    description: 'High-resolution computed tomography slices (DICOM, PNG)',
    accept: '.dcm,.png,.jpg,.jpeg',
    icon: Scan,
    color: 'text-[#3B2A1C] bg-[#FAF6F0] border-[#D9C6B7]',
  },
  {
    type: 'skin_image',
    label: 'Dermatology / Skin',
    category: 'imaging',
    description: 'Dermoscopic or clinical macro skin photos (PNG, JPEG, WEBP)',
    accept: '.png,.jpg,.jpeg,.webp',
    icon: Camera,
    color: 'text-[#8B6F5B] bg-[#FAF6F0] border-[#D9C6B7]',
  },
  {
    type: 'prescription',
    label: 'Prescription Order',
    category: 'document',
    description: 'Pharmacy or discharge medication orders (PDF, Image, TXT)',
    accept: '.pdf,.png,.jpg,.jpeg,.txt',
    icon: Pill,
    color: 'text-[#5A4D3B] bg-[#FAF6F0] border-[#D9C6B7]',
  },
];

export const CaseWorkspacePage: React.FC = () => {
  const { id: caseId } = useParams<{ id: string }>();

  const [caseRecord, setCaseRecord] = useState<CaseDetailRecord | null>(null);
  const [assets, setAssets] = useState<MedicalAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<
    | 'report'
    | 'orchestration'
    | 'screening'
    | 'knowledge'
    | 'gemini'
    | 'evidence'
    | 'conflicts'
    | 'graph'
    | 'evidence-graph'
    | 'council'
    | 'sensitivity'
    | 'explainability'
    | 'resources'
  >('report');

  // Upload Form State
  const [selectedModality, setSelectedModality] = useState<ModalityType>('chest_xray');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [clinicalContext, setClinicalContext] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Asset filtering tab
  const [assetTabFilter, setAssetTabFilter] = useState<'all' | 'imaging' | 'biosignal' | 'document'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCaseData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const [caseData, assetList] = await Promise.all([
        apiClient.getCase(caseId),
        apiClient.getCaseAssets(caseId),
      ]);
      setCaseRecord(caseData);
      setAssets(assetList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load case workspace';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchCaseData();
  }, [fetchCaseData]);

  // Modality auto-detection helper
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setFileToUpload(file);
    setUploadError(null);
    setUploadSuccess(null);

    // Heuristic detection based on extension and filename
    const name = file.name.toLowerCase();
    if (name.includes('xray') || name.includes('cxr') || name.includes('chest')) {
      setSelectedModality('chest_xray');
    } else if (name.includes('ecg') || name.includes('ekg') || name.includes('rhythm') || name.endsWith('.csv')) {
      setSelectedModality('ecg');
    } else if (name.includes('mri') || name.includes('flair') || name.includes('brain')) {
      setSelectedModality('mri');
    } else if (name.includes('ct') || name.includes('slice')) {
      setSelectedModality('ct');
    } else if (name.includes('skin') || name.includes('lesion') || name.includes('derm')) {
      setSelectedModality('skin_image');
    } else if (name.includes('prescription') || name.includes('rx')) {
      setSelectedModality('prescription');
    } else if (name.endsWith('.pdf')) {
      setSelectedModality('pdf_report');
    } else if (name.endsWith('.txt') || name.endsWith('.md')) {
      setSelectedModality('clinical_note');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId || !fileToUpload) {
      setUploadError('Please choose a file to ingest.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    setUploadProgressText('Computing SHA-256 checksum & validating MIME type...');

    try {
      setUploadProgressText('Encrypting & uploading to Supabase Storage...');
      const savedAsset = await apiClient.uploadCaseAsset(
        caseId,
        fileToUpload,
        selectedModality,
        clinicalContext.trim() || undefined
      );

      setUploadProgressText('Asset verified & indexed in clinical case graph.');
      setUploadSuccess(`Successfully uploaded ${savedAsset.filename} (${formatFileSize(savedAsset.size_bytes)})`);

      // Clear form
      setFileToUpload(null);
      setClinicalContext('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh asset list
      const updatedAssets = await apiClient.getCaseAssets(caseId);
      setAssets(updatedAssets);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Asset upload failed';
      setUploadError(msg);
    } finally {
      setUploading(false);
      setUploadProgressText('');
    }
  };

  const handleDeleteAsset = async (assetId: string, filename: string) => {
    if (!caseId) return;
    if (!window.confirm(`Are you sure you want to delete "${filename}" from this case?`)) return;

    try {
      await apiClient.deleteCaseAsset(caseId, assetId);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete asset');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getModalityBadge = (modality: string) => {
    const opt = MODALITY_OPTIONS.find((m) => m.type === modality);
    const Icon = opt?.icon || FileText;
    const label = opt?.label || modality.toUpperCase();
    const color = opt?.color || 'text-slate-300 bg-slate-800 border-slate-700';

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
    );
  };

  const filteredAssets = assets.filter((asset) => {
    if (assetTabFilter === 'all') return true;
    const opt = MODALITY_OPTIONS.find((m) => m.type === asset.modality);
    return opt?.category === assetTabFilter;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        <p className="text-sm text-slate-400 font-medium">Loading clinical case workspace...</p>
      </div>
    );
  }

  if (error || !caseRecord) {
    return (
      <div className="space-y-4">
        <Link
          to="/patients"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Patients Directory
        </Link>
        <Card className="p-8 bg-rose-500/10 border-rose-500/20 text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-semibold text-rose-200">Failed to Load Case Workspace</h2>
          <p className="text-sm text-rose-300/80 max-w-md mx-auto">{error || 'Case not found'}</p>
          <Button
            onClick={fetchCaseData}
            variant="outline"
            className="border-rose-800 text-rose-200 hover:bg-rose-950/50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* NAVIGATION BAR & BREADCRUMB */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to={`/patients/${caseRecord.patient_id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#D9C6B7] text-xs font-semibold text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5] transition-colors shadow-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Patient 360 ({caseRecord.patient_name || 'Patient'})
          </Link>
          <span className="text-[#D9C6B7]">/</span>
          <span className="text-xs text-[#6E5D4F] font-medium">Case Workspace</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCaseData}
            className="border-[#D9C6B7] text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-[#8B6F5B]" />
            Refresh Assets
          </Button>
        </div>
      </div>

      {/* CASE HEADER BANNER */}
      <Card className="p-6 bg-white border-[#D9C6B7] shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs px-2.5 py-1 rounded bg-[#FAF6F0] border border-[#D9C6B7] text-[#5A4D3B] font-semibold">
                {caseRecord.case_number}
              </span>
              <Badge
                variant={
                  caseRecord.priority === 'stat'
                    ? 'destructive'
                    : caseRecord.priority === 'urgent'
                    ? 'warning'
                    : 'default'
                }
              >
                Priority: {caseRecord.priority.toUpperCase()}
              </Badge>
              <Badge
                variant="outline"
                className="border-[#D9C6B7] bg-[#FAF6F0] text-[#5A4D3B]"
              >
                Status: {caseRecord.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#3B2A1C]">
              {caseRecord.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6E5D4F] font-medium">
              <span>
                <strong className="text-[#3B2A1C]">Patient:</strong>{' '}
                <Link
                  to={`/patients/${caseRecord.patient_id}`}
                  className="text-[#8B6F5B] hover:text-[#5A4D3B] underline font-semibold"
                >
                  {caseRecord.patient_name || 'View Patient'} ({caseRecord.patient_mrn || 'MRN'})
                </Link>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-[#8B6F5B]" />
                Initiated: {new Date(caseRecord.created_at).toLocaleString()}
              </span>
              <span>•</span>
              <span>
                <strong className="text-[#3B2A1C]">Assets Ingested:</strong> {assets.length}
              </span>
            </div>
          </div>
        </div>

        {/* CLINICAL CONTEXT STRIP */}
        <div className="mt-5 pt-4 border-t border-[#D9C6B7]/60 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6E5D4F]">
              Chief Complaint
            </span>
            <p className="text-xs text-[#3B2A1C] font-semibold">{caseRecord.chief_complaint}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6E5D4F]">
              Symptoms & Context
            </span>
            <div className="flex flex-wrap gap-1.5">
              {caseRecord.symptoms && caseRecord.symptoms.length > 0 ? (
                caseRecord.symptoms.map((sym, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-[#FAF6F0] border border-[#D9C6B7] text-[#5A4D3B] font-medium"
                  >
                    {sym}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[#8B6F5B] italic">None documented</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6E5D4F]">
              Clinical Intake Notes
            </span>
            <p className="text-xs text-[#5A4D3B] line-clamp-2">
              {caseRecord.clinical_notes || <span className="italic text-[#8B6F5B]">No notes provided</span>}
            </p>
          </div>
        </div>
      </Card>

      {/* PHASE 3 SAFETY / PROTOCOL NOTICE */}
      <div className="p-3.5 rounded-lg bg-[#FCF8F2] border border-[#D9C6B7] flex items-start gap-3">
        <Info className="h-5 w-5 text-[#8B6F5B] shrink-0 mt-0.5" />
        <div className="text-xs text-[#5A4D3B] leading-relaxed">
          <strong className="text-[#3B2A1C] font-semibold">Multimodal Case Intake Workspace:</strong>{' '}
          All imaging files, biosignals, lab panels, and clinical notes are cryptographically hashed (SHA-256) and securely stored in private Supabase Storage buckets with server-side patient authorization. Medical model screening and Gemini orchestration are verified through the clinical review pipeline.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ============================================================================== */}
        {/* MULTIMODAL INTAKE UPLOADER (4 COLS) */}
        {/* ============================================================================== */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm">
            <div className="border-b border-[#D9C6B7]/60 pb-3">
              <h2 className="text-base font-semibold text-[#3B2A1C] flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-[#8B6F5B]" />
                Multimodal Asset Ingestion
              </h2>
              <p className="text-xs text-[#6E5D4F] mt-1">
                Upload MRI, CT, Chest X-rays, ECG rhythms, skin photos, or clinical reports.
              </p>
            </div>

            {uploadError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Modality Selector Grid */}
              <div>
                <label className="block text-xs font-semibold text-[#3B2A1C] mb-2 uppercase tracking-wider">
                  Target Modality *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MODALITY_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = selectedModality === opt.type;
                    return (
                      <button
                        type="button"
                        key={opt.type}
                        onClick={() => setSelectedModality(opt.type)}
                        className={`p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                          isSelected
                            ? 'bg-[#F2E4D5] border-[#8B6F5B] text-[#3B2A1C] ring-1 ring-[#8B6F5B]'
                            : 'bg-[#FAF6F0] border-[#D9C6B7] text-[#5A4D3B] hover:border-[#8B6F5B] hover:text-[#3B2A1C]'
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${isSelected ? 'text-[#8B6F5B]' : 'text-[#8B6F5B]/70'}`} />
                        <div>
                          <div className="text-xs font-semibold leading-tight">{opt.label}</div>
                          <div className="text-[10px] text-[#6E5D4F] mt-0.5 line-clamp-1">{opt.accept}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* File Dropzone Input */}
              <div>
                <label className="block text-xs font-semibold text-[#3B2A1C] mb-1.5 uppercase tracking-wider">
                  Select File *
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${
                    fileToUpload
                      ? 'border-[#8B6F5B] bg-[#F2E4D5]/40'
                      : 'border-[#D9C6B7] hover:border-[#8B6F5B] bg-[#FAF6F0]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept={MODALITY_OPTIONS.find((m) => m.type === selectedModality)?.accept}
                    className="hidden"
                  />
                  {fileToUpload ? (
                    <div className="space-y-1">
                      <FileCheck2 className="h-7 w-7 text-emerald-700 mx-auto" />
                      <div className="text-xs font-semibold text-[#3B2A1C]">{fileToUpload.name}</div>
                      <div className="text-[11px] text-[#6E5D4F]">{formatFileSize(fileToUpload.size)}</div>
                      <div className="text-[10px] text-[#8B6F5B] font-semibold underline pt-1">Click to replace file</div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <UploadCloud className="h-7 w-7 text-[#8B6F5B] mx-auto" />
                      <div className="text-xs font-semibold text-[#3B2A1C]">
                        Drop file here or click to browse
                      </div>
                      <p className="text-[11px] text-[#6E5D4F]">
                        Supports {MODALITY_OPTIONS.find((m) => m.type === selectedModality)?.accept} (Max 50MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Clinical Context / Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#3B2A1C] mb-1.5 uppercase tracking-wider">
                  Clinical Intake Context (Optional)
                </label>
                <textarea
                  rows={2}
                  value={clinicalContext}
                  onChange={(e) => setClinicalContext(e.target.value)}
                  placeholder="e.g. PA radiograph upright, sinus tachycardia on lead II, or fasting metabolic draw"
                  className="w-full px-3 py-2 rounded-lg bg-[#FAF6F0] border border-[#D9C6B7] text-[#3B2A1C] placeholder-[#8B6F5B]/50 text-xs focus:outline-none focus:border-[#8B6F5B] focus:bg-white resize-none"
                />
              </div>

              {/* Progress Text */}
              {uploading && uploadProgressText && (
                <div className="p-2.5 rounded bg-[#FAF6F0] border border-[#D9C6B7] text-xs text-[#8B6F5B] flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8B6F5B]" />
                  <span>{uploadProgressText}</span>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={!fileToUpload || uploading}
                className="w-full text-xs py-2.5"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Ingesting Asset...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4 mr-2" />
                    Ingest {MODALITY_OPTIONS.find((m) => m.type === selectedModality)?.label}
                  </>
                )}
              </Button>
            </form>
          </Card>
        </div>

        {/* ============================================================================== */}
        {/* CASE WORKSPACE ASSET INVENTORY (7 COLS) */}
        {/* ============================================================================== */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-5 bg-white border-[#D9C6B7] space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9C6B7]/60 pb-3">
              <div>
                <h2 className="text-base font-semibold text-[#3B2A1C] flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-700" />
                  Ingested Case Assets Workspace
                </h2>
                <p className="text-xs text-[#6E5D4F] mt-1">
                  Cryptographically secured assets verified for patient {caseRecord.patient_name || caseRecord.patient_mrn}.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 p-1 bg-[#FAF6F0] rounded-lg border border-[#D9C6B7] text-xs">
                <button
                  type="button"
                  onClick={() => setAssetTabFilter('all')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    assetTabFilter === 'all'
                      ? 'bg-[#F2E4D5] text-[#3B2A1C] font-semibold'
                      : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
                  }`}
                >
                  All ({assets.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAssetTabFilter('imaging')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    assetTabFilter === 'imaging'
                      ? 'bg-[#F2E4D5] text-[#3B2A1C] font-semibold'
                      : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
                  }`}
                >
                  Imaging
                </button>
                <button
                  type="button"
                  onClick={() => setAssetTabFilter('biosignal')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    assetTabFilter === 'biosignal'
                      ? 'bg-[#F2E4D5] text-[#3B2A1C] font-semibold'
                      : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
                  }`}
                >
                  ECG
                </button>
                <button
                  type="button"
                  onClick={() => setAssetTabFilter('document')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    assetTabFilter === 'document'
                      ? 'bg-[#F2E4D5] text-[#3B2A1C] font-semibold'
                      : 'text-[#6E5D4F] hover:text-[#3B2A1C]'
                  }`}
                >
                  Docs
                </button>
              </div>
            </div>

            {/* ASSET LIST */}
            {filteredAssets.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <UploadCloud className="h-10 w-10 text-[#8B6F5B]/50 mx-auto" />
                <h3 className="text-sm font-semibold text-[#3B2A1C]">No Assets Ingested in this Category</h3>
                <p className="text-xs text-[#6E5D4F] max-w-sm mx-auto">
                  Use the multimodal intake form on the left to upload X-rays, ECGs, lab reports, or clinical notes.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAssets.map((asset) => {
                  const sha256 = asset.metadata?.checksum_sha256 as string | undefined;
                  const clinicalCtx = asset.metadata?.clinical_context as string | undefined;

                  return (
                    <div
                      key={asset.id}
                      className="p-4 rounded-xl bg-[#FAF6F0] border border-[#D9C6B7]/70 hover:border-[#8B6F5B] transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {getModalityBadge(asset.modality)}
                            <span className="font-mono text-xs font-semibold text-[#3B2A1C]">
                              {asset.filename}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6E5D4F]">
                            <span>
                              <strong className="text-[#3B2A1C]">Size:</strong> {formatFileSize(asset.size_bytes)}
                            </span>
                            <span>•</span>
                            <span>
                              <strong className="text-[#3B2A1C]">Type:</strong> {asset.mime_type}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-[#8B6F5B]" />
                              {new Date(asset.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2 self-start">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                            Verified & Stored
                          </span>
                        </div>
                      </div>

                      {/* Clinical Context / Notes */}
                      {clinicalCtx && (
                        <div className="p-2 rounded bg-white border border-[#D9C6B7]/60 text-xs text-[#5A4D3B]">
                          <strong className="text-[#3B2A1C]">Context:</strong> {clinicalCtx}
                        </div>
                      )}

                      {/* Checksum & Storage Path Strip */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#D9C6B7]/60 text-[11px]">
                        <div className="flex items-center gap-1.5 text-[#6E5D4F] font-mono">
                          <Hash className="h-3 w-3 text-[#8B6F5B]" />
                          <span>SHA-256:</span>
                          <span className="text-[#3B2A1C] font-medium">
                            {sha256 ? `${sha256.substring(0, 16)}...${sha256.substring(sha256.length - 8)}` : 'N/A'}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {asset.signed_url ? (
                            <a
                              href={asset.signed_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F2E4D5] hover:bg-[#EAE1D7] text-[#3B2A1C] text-xs font-semibold transition-colors border border-[#D9C6B7]"
                            >
                              <Eye className="h-3 w-3 text-[#8B6F5B]" />
                              View
                            </a>
                          ) : null}

                          {asset.signed_url ? (
                            <a
                              href={asset.signed_url}
                              download={asset.filename}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F2E4D5] hover:bg-[#EAE1D7] text-[#3B2A1C] text-xs font-semibold transition-colors border border-[#D9C6B7]"
                            >
                              <Download className="h-3 w-3 text-emerald-700" />
                              Download
                            </a>
                          ) : null}

                          {asset.modality === 'chest_xray' && (
                            <button
                              type="button"
                              onClick={() => {
                                const el = document.getElementById('specialized-screening-section');
                                el?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F2E4D5] hover:bg-[#EAE1D7] border border-[#D9C6B7] text-[#3B2A1C] text-xs font-semibold transition-colors"
                            >
                              <Scan className="h-3 w-3 text-[#8B6F5B]" />
                              Screen Radiograph
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteAsset(asset.id, asset.filename)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-rose-700 hover:bg-rose-50 text-xs font-medium transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* PHASE 7 & PHASE 6: MODEL ORCHESTRATION & SPECIALIZED SCREENING */}
      {/* ============================================================================== */}
      <div id="orchestration-and-screening-section" className="pt-6 border-t border-[#D9C6B7] space-y-4">
        {/* View Switcher Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 rounded-xl border border-[#D9C6B7] shadow-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setWorkspaceView('report')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                workspaceView === 'report'
                  ? 'bg-[#F2E4D5] border border-[#8B6F5B] text-[#3B2A1C] shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
              }`}
            >
              <FileText className="w-4 h-4 text-[#8B6F5B]" />
              <span>Screening Report</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-white border-[#D9C6B7] text-[#5A4D3B]">
                PHASE 15
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceView('orchestration')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                workspaceView === 'orchestration'
                  ? 'bg-[#F2E4D5] border border-[#8B6F5B] text-[#3B2A1C] shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
              }`}
            >
              <GitBranch className="w-4 h-4 text-[#8B6F5B]" />
              <span>Intelligent Model Orchestration Plan</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-white border-[#D9C6B7] text-[#5A4D3B]">
                PHASE 7
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceView('screening')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                workspaceView === 'screening'
                  ? 'bg-[#F2E4D5] border border-[#8B6F5B] text-[#3B2A1C] shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
              }`}
            >
              <Scan className="w-4 h-4 text-emerald-700" />
              <span>Specialized Screening Execution</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-emerald-50 border-emerald-200 text-emerald-800">
                ACTIVE
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceView('knowledge')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                workspaceView === 'knowledge'
                  ? 'bg-[#F2E4D5] border border-[#8B6F5B] text-[#3B2A1C] shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
              }`}
            >
              <BrainCircuit className="w-4 h-4 text-[#8B6F5B]" />
              <span>Patient Knowledge & RAG Evidence</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-white border-[#D9C6B7] text-[#5A4D3B]">
                PHASE 9
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceView('gemini')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                workspaceView === 'gemini'
                  ? 'bg-[#F2E4D5] border border-[#8B6F5B] text-[#3B2A1C] shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Gemini Evidence Synthesis</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-white border-[#D9C6B7] text-[#5A4D3B]">
                PHASE 10
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceView('evidence-graph')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                workspaceView === 'evidence-graph'
                  ? 'bg-[#F2E4D5] border border-[#8B6F5B] text-[#3B2A1C] shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
              }`}
            >
              <GitGraph className="w-4 h-4 text-[#8B6F5B]" />
              <span>Interactive Evidence Graph</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-white border-[#D9C6B7] text-[#5A4D3B]">
                PHASE 14
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceView('evidence')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                workspaceView === 'evidence'
                  ? 'bg-[#F2E4D5] border border-[#8B6F5B] text-[#3B2A1C] shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
              }`}
            >
              <Layers className="w-4 h-4 text-[#8B6F5B]" />
              <span>Canonical Evidence DAG</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-white border-[#D9C6B7] text-[#5A4D3B]">
                PHASE 11
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceView('graph')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                workspaceView === 'graph'
                  ? 'bg-[#F2E4D5] border border-[#8B6F5B] text-[#3B2A1C] shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
              }`}
            >
              <Network className="w-4 h-4 text-[#8B6F5B]" />
              <span>Live Orchestration Graph</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-white border-[#D9C6B7] text-[#5A4D3B]">
                PHASE 13
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceView('conflicts')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                workspaceView === 'conflicts'
                  ? 'bg-[#F2E4D5] border border-[#8B6F5B] text-[#3B2A1C] shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Conflict Detection & Review</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-white border-[#D9C6B7] text-[#5A4D3B]">
                PHASE 12
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceView('council')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                workspaceView === 'council'
                  ? 'bg-[#F2E4D5] border border-[#8B6F5B] text-[#3B2A1C] shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
              }`}
            >
              <Users className="w-4 h-4 text-[#8B6F5B]" />
              <span>Model Council</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-white border-[#D9C6B7] text-[#5A4D3B]">
                PHASE 16
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceView('sensitivity')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                workspaceView === 'sensitivity'
                  ? 'bg-[#F2E4D5] border border-[#8B6F5B] text-[#3B2A1C] shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
              }`}
            >
              <Scale className="w-4 h-4 text-[#8B6F5B]" />
              <span>Evidence Sensitivity</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-white border-[#D9C6B7] text-[#5A4D3B]">
                PHASE 16
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceView('explainability')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                workspaceView === 'explainability'
                  ? 'bg-[#F2E4D5] border border-[#8B6F5B] text-[#3B2A1C] shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
              }`}
            >
              <Eye className="w-4 h-4 text-[#8B6F5B]" />
              <span>Model Explainability</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-white border-[#D9C6B7] text-[#5A4D3B]">
                PHASE 16
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceView('resources')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                workspaceView === 'resources'
                  ? 'bg-[#F2E4D5] border border-[#8B6F5B] text-[#3B2A1C] shadow-sm'
                  : 'text-[#6E5D4F] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]/40'
              }`}
            >
              <Activity className="w-4 h-4 text-emerald-700" />
              <span>Resource Dashboard</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-white border-[#D9C6B7] text-[#5A4D3B]">
                PHASE 16
              </Badge>
            </button>
          </div>

          <span className="text-[11px] text-[#8B6F5B] font-mono hidden sm:inline-block px-2">
            Deterministic DAG Architecture • Zero Simulated Output
          </span>
        </div>

        {/* Dynamic View Display */}
        {workspaceView === 'report' && caseId ? (
          <ScreeningReportView
            caseId={caseId}
            patientId={caseRecord?.patient_id}
            onNavigateToTab={(tab) => {
              if (
                tab === 'report' ||
                tab === 'screening' ||
                tab === 'knowledge' ||
                tab === 'gemini' ||
                tab === 'evidence' ||
                tab === 'conflicts' ||
                tab === 'orchestration' ||
                tab === 'graph' ||
                tab === 'evidence-graph'
              ) {
                setWorkspaceView(tab as any);
              }
            }}
          />
        ) : workspaceView === 'evidence-graph' && caseId ? (
          <InteractiveEvidenceGraph
            caseId={caseId}
            patientId={caseRecord?.patient_id}
            onNavigateToTab={(tab) => {
              if (
                tab === 'report' ||
                tab === 'screening' ||
                tab === 'knowledge' ||
                tab === 'gemini' ||
                tab === 'evidence' ||
                tab === 'conflicts' ||
                tab === 'orchestration' ||
                tab === 'graph' ||
                tab === 'evidence-graph'
              ) {
                setWorkspaceView(tab as any);
              }
            }}
          />
        ) : workspaceView === 'graph' && caseId ? (
          <RealtimeOrchestrationGraph
            caseId={caseId}
            patientId={caseRecord?.patient_id}
            onNavigateToTab={(tab) => {
              if (
                tab === 'screening' ||
                tab === 'knowledge' ||
                tab === 'gemini' ||
                tab === 'evidence' ||
                tab === 'conflicts' ||
                tab === 'orchestration'
              ) {
                setWorkspaceView(tab);
              }
            }}
          />
        ) : workspaceView === 'conflicts' && caseId ? (
          <ConflictResolutionView
            caseId={caseId}
            patientId={caseRecord?.patient_id}
            onNavigateToTab={(tab) => {
              if (tab === 'screening' || tab === 'knowledge' || tab === 'gemini' || tab === 'evidence') {
                setWorkspaceView(tab);
              }
            }}
          />
        ) : workspaceView === 'evidence' && caseId ? (
          <CanonicalEvidenceExplorer
            caseId={caseId}
            patientId={caseRecord?.patient_id}
            onNavigateToTab={(tab) => {
              if (tab === 'screening' || tab === 'knowledge' || tab === 'gemini') {
                setWorkspaceView(tab);
              }
            }}
          />
        ) : workspaceView === 'gemini' && caseId ? (
          <GeminiEvidenceView
            caseId={caseId}
            patientId={caseRecord?.patient_id}
          />
        ) : workspaceView === 'knowledge' && caseRecord?.patient_id ? (
          <PatientKnowledgeView
            patientId={caseRecord.patient_id}
            caseId={caseId}
            patientName={`Case #${caseId?.slice(0, 8)}`}
          />
        ) : workspaceView === 'orchestration' ? (
          <OrchestrationPlanView
            caseId={caseId!}
            patientId={caseRecord?.patient_id}
            assets={assets}
            onSelectCapability={() => setWorkspaceView('screening')}
          />
        ) : workspaceView === 'council' && caseId ? (
          <ModelCouncilView
            caseId={caseId}
            assetId={assets.find((a) => a.modality === 'chest_xray')?.id || assets[0]?.id}
          />
        ) : workspaceView === 'sensitivity' && caseId ? (
          <EvidenceSensitivityView caseId={caseId} />
        ) : workspaceView === 'explainability' && caseId ? (
          <ImagingExplainabilityView
            assetId={assets.find((a) => a.modality === 'chest_xray')?.id || assets[0]?.id || ''}
            caseId={caseId}
          />
        ) : workspaceView === 'resources' ? (
          <ResourceDashboardWidget />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#3B2A1C] flex items-center gap-2">
                  <Scan className="w-5 h-5 text-emerald-700" />
                  Specialized AI Screening Analysis
                </h3>
                <p className="text-xs text-[#6E5D4F] mt-0.5">
                  Real PyTorch TorchXRayVision DenseNet-121 inference with multi-label pathology detection, operating thresholds, and clinical audit ledger.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWorkspaceView('orchestration')}
                className="text-xs border-[#D9C6B7] bg-white text-[#5A4D3B] hover:text-[#3B2A1C] hover:bg-[#F2E4D5]"
              >
                <GitBranch className="w-3.5 h-3.5 mr-1.5 text-[#8B6F5B]" />
                View Orchestration Plan
              </Button>
            </div>

            <ModelRunView
              caseId={caseId!}
              patientId={caseRecord?.patient_id}
              assets={assets}
            />
          </div>
        )}
      </div>
    </div>
  );
};
