import { ENV } from '../config/env';
import type {
  HealthStatusResponse,
  ApiErrorResponse,
  PatientRecord,
  PatientSummary,
  ClinicalEvent,
  CaseRecord,
  CaseDetailRecord,
  MedicalAsset,
  DocumentRecord,
  ScreeningReportRecord,
  ModelStatusResponse,
  ModelRunRecord,
  ModelRegistryItem,
  ModelCompatibilityResponse,
  ModelHealthInfo,
  ClinicalCapability,
  CapabilityResolveResponse,
  CapabilityHealthInfo,
  OrchestrationPlan,
  ResourceSnapshotData,
  SchedulerDashboardData,
  SimulatedLimitsConfig,
  SchedulerEventItem,
  EvidenceSearchResponse,
  PatientKnowledgeResponse,
  RAGIngestResponse,
  GeminiStatusResponse,
  GeminiSynthesisResult,
  GeminiSynthesisRequest,
  CanonicalCaseEvidenceGraph,
  CanonicalEvidenceItem,
  CanonicalFinding,
  CaseReviewAssessment,
  StructuredConflictItem,
  ReconstructedGraphState,
  OrchestrationRunSummary,
  ClinicalIntelligenceSummary,
  ScreeningReportSignOffRequest,
  ModelCouncilResult,
  EvidenceSensitivityAssessment,
  ImagingExplainabilityResult,
} from '../types/api';

export class ApiClientError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

let _authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  _authToken = token;
}

export function getAuthToken(): string | null {
  return _authToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${ENV.API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      let errorDetails: unknown = null;

      try {
        const errorJson = (await response.json()) as ApiErrorResponse;
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
          errorDetails = errorJson.error.details;
          if (Array.isArray(errorDetails) && errorDetails.length > 0) {
            const formatted = (errorDetails as Array<{ loc?: string[]; msg?: string }>)
              .map((d) => {
                const loc = Array.isArray(d.loc)
                  ? d.loc.filter((l) => l !== 'body').join('.')
                  : '';
                return loc ? `${loc}: ${d.msg}` : d.msg;
              })
              .filter(Boolean)
              .join('; ');
            if (formatted && !errorMessage.includes(formatted)) {
              errorMessage = `${errorMessage} (${formatted})`;
            }
          }
        } else if ((errorJson as unknown as { detail?: string }).detail) {
          errorMessage = (errorJson as unknown as { detail: string }).detail;
        }
      } catch {
        // Non-JSON response
      }

      throw new ApiClientError(errorMessage, response.status, errorDetails);
    }


    if (response.status === 204) {
      return null as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    throw new ApiClientError(
      error instanceof Error ? error.message : 'Network error or backend unreachable',
      0,
    );
  }
}

export const apiClient = {
  setAuthToken,
  getAuthToken,

  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { method: 'GET', ...options }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { method: 'DELETE', ...options }),

  // System
  getHealth: () => request<HealthStatusResponse>('/health'),
  getMe: () => request<{ id: string; email: string; role: string; profile: Record<string, unknown> }>('/api/v1/auth/me'),

  // Patient CRUD
  getPatients: (params?: { search?: string; gender?: string; blood_type?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.gender) q.append('gender', params.gender);
    if (params?.blood_type) q.append('blood_type', params.blood_type);
    const queryString = q.toString() ? `?${q.toString()}` : '';
    return request<PatientRecord[]>(`/api/v1/patients/${queryString}`);
  },
  getPatient: (id: string) => request<PatientRecord>(`/api/v1/patients/${id}`),
  createPatient: (data: Partial<PatientRecord>) =>
    request<PatientRecord>('/api/v1/patients/', { method: 'POST', body: JSON.stringify(data) }),
  updatePatient: (id: string, data: Partial<PatientRecord>) =>
    request<PatientRecord>(`/api/v1/patients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePatient: (id: string) =>
    request<void>(`/api/v1/patients/${id}`, { method: 'DELETE' }),

  // Patient 360 Aggregation
  getPatientSummary: (id: string) => request<PatientSummary>(`/api/v1/patients/${id}/summary`),

  // Timeline
  getPatientTimeline: (id: string) => request<ClinicalEvent[]>(`/api/v1/patients/${id}/timeline`),
  addTimelineEvent: (id: string, data: Partial<ClinicalEvent>) =>
    request<ClinicalEvent>(`/api/v1/patients/${id}/timeline`, { method: 'POST', body: JSON.stringify(data) }),

  // Cases
  getPatientCases: (id: string) => request<CaseRecord[]>(`/api/v1/patients/${id}/cases`),
  createPatientCase: (id: string, data: Partial<CaseRecord>) =>
    request<CaseRecord>(`/api/v1/patients/${id}/cases`, { method: 'POST', body: JSON.stringify(data) }),

  // Documents
  getPatientDocuments: (id: string) => request<DocumentRecord[]>(`/api/v1/patients/${id}/documents`),
  addPatientDocument: (id: string, data: Partial<DocumentRecord>) =>
    request<DocumentRecord>(`/api/v1/patients/${id}/documents`, { method: 'POST', body: JSON.stringify(data) }),

  // Reports
  getPatientReports: (id: string) => request<ScreeningReportRecord[]>(`/api/v1/patients/${id}/reports`),
  addPatientReport: (id: string, data: Partial<ScreeningReportRecord>) =>
    request<ScreeningReportRecord>(`/api/v1/patients/${id}/reports`, { method: 'POST', body: JSON.stringify(data) }),

  // Multimodal Cases & Assets
  getCases: (patientId?: string) => {
    const q = patientId ? `?patient_id=${patientId}` : '';
    return request<CaseRecord[]>(`/api/v1/cases/${q}`);
  },
  getCase: (caseId: string) => request<CaseDetailRecord>(`/api/v1/cases/${caseId}`),
  createCase: (data: {
    patient_id: string;
    title: string;
    chief_complaint: string;
    symptoms?: string[];
    clinical_notes?: string;
    priority?: string;
  }) => request<CaseRecord>('/api/v1/cases/', { method: 'POST', body: JSON.stringify(data) }),
  updateCase: (caseId: string, data: Partial<CaseRecord>) =>
    request<CaseRecord>(`/api/v1/cases/${caseId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getCaseAssets: (caseId: string) => request<MedicalAsset[]>(`/api/v1/cases/${caseId}/assets`),
  uploadCaseAsset: (caseId: string, file: File, modality: string, clinicalContext?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('modality', modality);
    if (clinicalContext) {
      formData.append('clinical_context', clinicalContext);
    }
    return request<MedicalAsset>(`/api/v1/cases/${caseId}/assets`, {
      method: 'POST',
      body: formData,
    });
  },
  deleteCaseAsset: (caseId: string, assetId: string) =>
    request<void>(`/api/v1/cases/${caseId}/assets/${assetId}`, { method: 'DELETE' }),
  getCaseAssetUrl: (caseId: string, assetId: string) =>
    request<{ asset_id: string; filename: string; signed_url: string; expires_in_seconds: number }>(
      `/api/v1/cases/${caseId}/assets/${assetId}/url`
    ),

  // Specialized Medical Models (Phase 4)
  getModelStatus: (modelId: string = 'torchxrayvision-densenet121') =>
    request<ModelStatusResponse>(`/api/v1/models/status?model_id=${encodeURIComponent(modelId)}`),
  getCaseModelRuns: (caseId: string) =>
    request<ModelRunRecord[]>(`/api/v1/models/cases/${caseId}/runs`),
  getCaseModelRun: (caseId: string, runId: string) =>
    request<ModelRunRecord>(`/api/v1/models/cases/${caseId}/runs/${runId}`),
  executeModelRun: (
    caseId: string,
    assetId: string,
    capabilityId?: string,
    modelId?: string
  ) =>
    request<ModelRunRecord>(`/api/v1/models/cases/${caseId}/run`, {
      method: 'POST',
      body: JSON.stringify({
        asset_id: assetId,
        capability_id: capabilityId,
        model_id: modelId,
      }),
    }),

  // Model Registry (Phase 5)
  getRegistryModels: (params?: { modality?: string; capability?: string; domain?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.modality) q.append('modality', params.modality);
    if (params?.capability) q.append('capability', params.capability);
    if (params?.domain) q.append('domain', params.domain);
    if (params?.status) q.append('status', params.status);
    const queryString = q.toString() ? `?${q.toString()}` : '';
    return request<ModelRegistryItem[]>(`/api/v1/registry/models${queryString}`);
  },
  getRegistryModel: (id: string) =>
    request<ModelRegistryItem>(`/api/v1/registry/models/${encodeURIComponent(id)}`),
  registerModel: (data: Partial<ModelRegistryItem>) =>
    request<ModelRegistryItem>('/api/v1/registry/models', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateRegistryModel: (id: string, data: Partial<ModelRegistryItem>) =>
    request<ModelRegistryItem>(`/api/v1/registry/models/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  queryModelCompatibility: (modality: string, capability?: string) => {
    const q = new URLSearchParams({ modality });
    if (capability) q.append('capability', capability);
    return request<ModelCompatibilityResponse>(`/api/v1/registry/compatibility?${q.toString()}`);
  },
  getModelHealth: (id: string) =>
    request<ModelHealthInfo>(`/api/v1/registry/models/${encodeURIComponent(id)}/health`),

  // Six-Capability Architecture (Phase 6)
  getCapabilities: (params?: { modality?: string; status?: string; runnable_only?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.modality) q.append('modality', params.modality);
    if (params?.status) q.append('status', params.status);
    if (params?.runnable_only !== undefined) q.append('runnable_only', String(params.runnable_only));
    const queryString = q.toString() ? `?${q.toString()}` : '';
    return request<ClinicalCapability[]>(`/api/v1/capabilities${queryString}`);
  },
  getCapability: (capabilityId: string) =>
    request<ClinicalCapability>(`/api/v1/capabilities/${encodeURIComponent(capabilityId)}`),
  resolveCapabilities: (modality: string, runnableOnly: boolean = false) => {
    const q = new URLSearchParams({ modality, runnable_only: String(runnableOnly) });
    return request<CapabilityResolveResponse>(`/api/v1/capabilities/resolve?${q.toString()}`);
  },
  getCapabilityHealth: (capabilityId: string) =>
    request<CapabilityHealthInfo>(`/api/v1/capabilities/${encodeURIComponent(capabilityId)}/health`),

  // Intelligent Model Orchestrator (Phase 7)
  generateCasePlan: (caseId: string, payload?: { symptoms_context?: string | string[]; force_replan?: boolean }) => {
    const cleanPayload: Record<string, unknown> = {};
    if (payload?.symptoms_context !== undefined && payload.symptoms_context !== null) {
      cleanPayload.symptoms_context = payload.symptoms_context;
    }
    if (payload?.force_replan !== undefined) {
      cleanPayload.force_replan = payload.force_replan;
    }
    return request<OrchestrationPlan>(`/api/v1/orchestration/cases/${encodeURIComponent(caseId)}/plan`, {
      method: 'POST',
      body: JSON.stringify(cleanPayload),
    });
  },

  getCasePlan: (caseId: string) =>
    request<OrchestrationPlan>(`/api/v1/orchestration/cases/${encodeURIComponent(caseId)}/plan`),
  getPlanById: (planId: string) =>
    request<OrchestrationPlan>(`/api/v1/orchestration/plans/${encodeURIComponent(planId)}`),
  getOrchestrationResources: () =>
    request<ResourceSnapshotData>('/api/v1/orchestration/resources'),

  // Resource-Aware Scheduler (Phase 8)
  getSchedulerDashboard: () =>
    request<SchedulerDashboardData>('/api/v1/scheduler/dashboard'),
  configureSimulatedLimits: (data: {
    enabled: boolean;
    max_ram_mb?: number | null;
    max_vram_mb?: number | null;
    artificial_delay_ms?: number;
  }) =>
    request<SimulatedLimitsConfig>('/api/v1/scheduler/simulated-limits', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  unloadSchedulerModel: (capabilityId: string) =>
    request<{ success: boolean; capability_id: string; message: string }>(
      `/api/v1/scheduler/models/${encodeURIComponent(capabilityId)}/unload`,
      { method: 'POST' }
    ),
  unloadAllSchedulerModels: () =>
    request<{ success: boolean; evicted_models: string[]; message: string }>(
      '/api/v1/scheduler/unload-all',
      { method: 'POST' }
    ),
  getSchedulerEvents: (limit: number = 50) =>
    request<SchedulerEventItem[]>(`/api/v1/scheduler/events?limit=${limit}`),

  searchEvidence: (payload: {
    patient_id: string;
    query: string;
    case_id?: string;
    domain?: string;
    document_type?: string;
    top_k?: number;
    match_threshold?: number;
    temporal_scope?: 'all' | 'current' | 'historical';
    current_threshold_days?: number;
  }) =>
    request<EvidenceSearchResponse>('/api/v1/rag/search', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  ingestText: (payload: {
    patient_id: string;
    content: string;
    filename?: string;
    document_type?: string;
    case_id?: string;
    document_id?: string;
    event_date?: string;
    domain?: string;
    source_path?: string;
    metadata?: Record<string, unknown>;
  }) =>
    request<RAGIngestResponse>('/api/v1/rag/ingest/text', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  ingestFile: (formData: FormData) =>
    request<RAGIngestResponse>('/api/v1/rag/ingest/file', {
      method: 'POST',
      body: formData,
    }),
  getPatientKnowledge: (patientId: string, params?: { case_id?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.case_id) q.append('case_id', params.case_id);
    if (params?.limit) q.append('limit', String(params.limit));
    if (params?.offset) q.append('offset', String(params.offset));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<PatientKnowledgeResponse>(`/api/v1/rag/patient/${encodeURIComponent(patientId)}/knowledge${qs}`);
  },
  deleteKnowledgeChunk: (chunkId: string) =>
    request<{ message: string }>(`/api/v1/rag/chunks/${encodeURIComponent(chunkId)}`, {
      method: 'DELETE',
    }),

  // Gemini Evidence-Language Layer (Phase 10)
  getGeminiStatus: () =>
    request<GeminiStatusResponse>('/api/v1/gemini/status'),
  synthesizeEvidence: (payload: GeminiSynthesisRequest) =>
    request<GeminiSynthesisResult>('/api/v1/gemini/synthesize', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  synthesizeCaseEvidence: (caseId: string, action?: string) => {
    const q = action ? `?action=${encodeURIComponent(action)}` : '';
    return request<GeminiSynthesisResult>(`/api/v1/gemini/case/${encodeURIComponent(caseId)}/synthesize${q}`, {
      method: 'POST',
    });
  },

  // Canonical Evidence System (Phase 11)
  getCaseEvidenceGraph: (caseId: string, patientId?: string) => {
    const q = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : '';
    return request<CanonicalCaseEvidenceGraph>(`/api/v1/evidence/case/${encodeURIComponent(caseId)}${q}`);
  },
  getEvidenceItem: (evidenceId: string) =>
    request<CanonicalEvidenceItem>(`/api/v1/evidence/item/${encodeURIComponent(evidenceId)}`),
  getFinding: (findingId: string) =>
    request<CanonicalFinding>(`/api/v1/evidence/finding/${encodeURIComponent(findingId)}`),
  createSynthesisEvidence: (
    caseId: string,
    payload: { title: string; summary: string; content?: string; supporting_evidence_ids: string[] },
    patientId?: string
  ) => {
    const q = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : '';
    return request<CanonicalEvidenceItem>(`/api/v1/evidence/case/${encodeURIComponent(caseId)}/synthesis${q}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Structured Conflict Detection (Phase 12)
  getCaseReviewAssessment: (caseId: string, patientId?: string) => {
    const q = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : '';
    return request<CaseReviewAssessment>(`/api/v1/conflicts/case/${encodeURIComponent(caseId)}${q}`);
  },
  reevaluateCaseConflicts: (caseId: string, patientId?: string) => {
    const q = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : '';
    return request<CaseReviewAssessment>(`/api/v1/conflicts/case/${encodeURIComponent(caseId)}/evaluate${q}`, {
      method: 'POST',
    });
  },
  createSyntheticConflictFixture: (caseId: string, fixtureType: string, patientId?: string) => {
    const q = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : '';
    return request<CaseReviewAssessment>(`/api/v1/conflicts/case/${encodeURIComponent(caseId)}/fixture${q}`, {
      method: 'POST',
      body: JSON.stringify({ fixture_type: fixtureType }),
    });
  },
  resolveConflict: (conflictId: string, status: string, resolutionNotes: string) =>
    request<{ message: string; conflict: StructuredConflictItem }>(
      `/api/v1/conflicts/${encodeURIComponent(conflictId)}/resolve`,
      {
        method: 'POST',
        body: JSON.stringify({ status, resolution_notes: resolutionNotes }),
      }
    ),

  // PHASE 13: Live Orchestration Graph & WebSocket Helpers
  getCaseOrchestrationGraph: (caseId: string, runId?: string) => {
    const q = runId ? `?run_id=${encodeURIComponent(runId)}` : '';
    return request<ReconstructedGraphState>(`/api/v1/orchestration-graph/case/${encodeURIComponent(caseId)}/graph${q}`);
  },
  listCaseOrchestrationRuns: (caseId: string) =>
    request<OrchestrationRunSummary[]>(`/api/v1/orchestration-graph/case/${encodeURIComponent(caseId)}/runs`),
  executeCaseOrchestration: (caseId: string, forceRecompute: boolean = false) =>
    request<ReconstructedGraphState>(`/api/v1/orchestration-graph/case/${encodeURIComponent(caseId)}/execute`, {
      method: 'POST',
      body: JSON.stringify({ force_recompute: forceRecompute, simulate_delay_ms: 0 }),
    }),

  // PHASE 15: Clinician-Facing Screening Report & Clinical Intelligence Summary
  getCaseScreeningReport: (caseId: string, forceRegenerate: boolean = false) => {
    const q = forceRegenerate ? '?force_regenerate=true' : '';
    return request<ClinicalIntelligenceSummary>(`/api/v1/reports/cases/${encodeURIComponent(caseId)}/screening-report${q}`);
  },
  generateCaseScreeningReport: (caseId: string) =>
    request<ClinicalIntelligenceSummary>(`/api/v1/reports/cases/${encodeURIComponent(caseId)}/screening-report/generate`, {
      method: 'POST',
    }),
  signOffScreeningReport: (caseId: string, payload: ScreeningReportSignOffRequest) =>
    request<ClinicalIntelligenceSummary>(`/api/v1/reports/cases/${encodeURIComponent(caseId)}/screening-report/sign-off`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  exportScreeningReportMarkdownUrl: (caseId: string) =>
    `${ENV.API_BASE_URL}/api/v1/reports/cases/${encodeURIComponent(caseId)}/screening-report/export`,

  // PHASE 16: Model Council, Evidence Sensitivity & Model-Specific Imaging Explainability
  deliberateCouncil: (caseId: string, assetId: string, forceCouncil: boolean = false) =>
    request<ModelCouncilResult>('/api/v1/council/deliberate', {
      method: 'POST',
      body: JSON.stringify({
        case_id: caseId,
        asset_id: assetId,
        force_council: forceCouncil,
      }),
    }),
  getCaseCouncil: (caseId: string, assetId: string, force: boolean = false) =>
    request<ModelCouncilResult>(
      `/api/v1/council/case/${encodeURIComponent(caseId)}?asset_id=${encodeURIComponent(assetId)}&force=${force}`
    ),
  getCaseSensitivity: (caseId: string) =>
    request<EvidenceSensitivityAssessment>(`/api/v1/sensitivity/case/${encodeURIComponent(caseId)}`),
  generateImagingExplainability: (assetId: string, targetPathology: string = 'Pneumonia', caseId?: string) =>
    request<ImagingExplainabilityResult>('/api/v1/explainability/generate', {
      method: 'POST',
      body: JSON.stringify({
        asset_id: assetId,
        target_pathology: targetPathology,
        case_id: caseId,
      }),
    }),
  getAssetExplainability: (assetId: string, targetPathology: string = 'Pneumonia', caseId?: string) => {
    const q = new URLSearchParams({ target_pathology: targetPathology });
    if (caseId) q.append('case_id', caseId);
    return request<ImagingExplainabilityResult>(`/api/v1/explainability/asset/${encodeURIComponent(assetId)}?${q.toString()}`);
  },
};

export const api = apiClient;





