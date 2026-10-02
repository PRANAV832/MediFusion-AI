export interface HealthStatusResponse {
  status: 'ok' | 'degraded' | 'error';
  environment: string;
  version: string;
  timestamp: string;
  uptime_seconds: number;
}

export interface ApiErrorDetail {
  message: string;
  type: string;
  details?: Record<string, unknown> | Array<unknown>;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}

export interface PatientRecord {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  blood_type?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  assigned_clinician_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PatientSummary {
  patient: PatientRecord;
  total_cases: number;
  total_events: number;
  total_documents: number;
  total_reports: number;
  active_conditions: string[];
  allergies: string[];
  last_activity_date?: string;
}

export interface ClinicalEvent {
  id: string;
  patient_id: string;
  case_id?: string;
  event_type: 'consultation' | 'lab_result' | 'imaging' | 'prescription' | 'admission' | 'diagnosis' | string;
  event_date: string;
  summary: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
}

export interface CaseRecord {
  id: string;
  patient_id: string;
  case_number: string;
  title: string;
  chief_complaint: string;
  symptoms: string[];
  clinical_notes?: string;
  status: 'draft' | 'intake_pending' | 'orchestrating' | 'completed' | 'review_required';
  priority: 'routine' | 'urgent' | 'stat';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRecord {
  id: string;
  patient_id: string;
  title: string;
  document_type: string;
  document_date: string;
  department?: string;
  author_name?: string;
  summary?: string;
  file_url?: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ScreeningReportRecord {
  id: string;
  patient_id: string;
  case_id?: string;
  title: string;
  report_type: string;
  status: string;
  findings_summary?: string;
  recommendations?: string;
  review_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type ModalityType =
  | 'mri'
  | 'ct'
  | 'chest_xray'
  | 'ecg'
  | 'skin_image'
  | 'pdf_report'
  | 'prescription'
  | 'clinical_note';

export interface MedicalAsset {
  id: string;
  patient_id: string;
  case_id: string;
  modality: ModalityType | string;
  filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  metadata?: {
    checksum_sha256?: string;
    original_filename?: string;
    clinical_context?: string;
    upload_status?: string;
    [key: string]: unknown;
  };
  created_by?: string;
  created_at: string;
  signed_url?: string;
}

export interface CaseDetailRecord extends CaseRecord {
  patient_mrn?: string;
  patient_name?: string;
  asset_count?: number;
}

export type ModelStatusState = 'READY' | 'NOT_CONFIGURED' | 'MODEL_UNAVAILABLE' | 'ERROR';

export interface ModelStatusResponse {
  model_id: string;
  model_version: string;
  capability: string;
  status: ModelStatusState;
  status_message: string;
  device: string;
  gpu_available: boolean;
  weights_available: boolean;
  dependencies_installed: boolean;
  pathologies: string[];
  limitations: string[];
}

export interface ModelFinding {
  pathology: string;
  probability: number;
  detected: boolean;
  threshold: number;
  ppv80_threshold?: number;
  severity?: 'high' | 'moderate' | 'normal' | string;
}

export interface ModelProvenance {
  model_name: string;
  architecture: string;
  weights_source: string;
  weights_hash?: string;
  training_datasets: string[];
  citation: string;
  license: string;
  input_dimensions: string;
  normalization_range: string;
  input_asset_filename?: string;
  input_asset_sha256?: string;
  execution_timestamp: string;
  torch_version: string;
  torchxrayvision_version: string;
  device: string;
}

export interface ModelRunRecord {
  id: string;
  case_id: string;
  patient_id: string;
  asset_id: string;
  model_id: string;
  model_version: string;
  capability: string;
  status: 'completed' | 'failed' | string;
  findings: ModelFinding[];
  scores: Record<string, number>;
  runtime_ms: number;
  device: string;
  provenance: ModelProvenance;
  limitations: string[];
  error_message?: string;
  created_by?: string;
  created_at: string;
}

export interface ModelRegistryItem {
  id: string;
  name: string;
  version: string;
  domain: string;
  modality: string;
  capabilities: string[];
  framework: string;
  artifact_source: string;
  parameter_count: number;
  estimated_ram_mb: number;
  estimated_vram_mb: number;
  expected_latency_ms: number;
  device_support: string[];
  status: string;
  provenance: Record<string, unknown>;
  limitations: string[];
  license: string;
  checksum?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  runtime_status?: string;
}

export interface ModelCompatibilityResponse {
  modality: string;
  capability?: string;
  compatible_models: ModelRegistryItem[];
  count: number;
}

export interface ModelHealthInfo {
  model_id: string;
  status: string;
  runtime_ready: boolean;
  device: string;
  gpu_available: boolean;
  weights_present: boolean;
  dependencies_ready: boolean;
  last_verified_at: string;
  details: Record<string, unknown>;
}

export interface VerificationCheckItem {
  verified: boolean;
  details: string;
}

export interface CapabilityVerificationDetails {
  verified: boolean;
  status: string;
  capability_id: string;
  adapter_class: string;
  checklist?: Record<string, VerificationCheckItem>;
  failure_reasons?: string[];
}

export interface ClinicalCapability {
  capability_id: string;
  name: string;
  description: string;
  expected_modality: string;
  adapter_class: string;
  preprocessing_contract: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  model_source: string;
  provenance: Record<string, unknown>;
  limitations: string[];
  license: string;
  status: 'ready' | 'not_configured' | string;
  model_id?: string;
  verification_details: CapabilityVerificationDetails;
  created_at?: string;
  updated_at?: string;
}

export interface CapabilityResolveResponse {
  modality: string;
  runnable_only: boolean;
  capabilities: ClinicalCapability[];
  count: number;
}

export interface CapabilityHealthInfo {
  capability_id: string;
  status: string;
  runtime_ready: boolean;
  device: string;
  weights_present: boolean;
  dependencies_ready: boolean;
  verification_details: CapabilityVerificationDetails;
  last_verified_at: string;
}

// ==========================================
// PHASE 7: MODEL ORCHESTRATION TYPES
// ==========================================

export interface SelectedModelItem {
  capability_id: string;
  capability_name: string;
  model_id: string;
  model_name: string;
  modality: string;
  asset_id: string;
  asset_filename: string;
  status: 'ready' | 'not_configured' | string;
  estimated_ram_mb: number;
  estimated_latency_ms: number;
  device: string;
  selection_reason: string;
}

export interface SkippedCapabilityItem {
  capability_id: string;
  capability_name: string;
  expected_modality: string;
  skip_reason: string;
  status: string;
}

export interface ExecutionStepItem {
  step_number: number;
  node_id: string;
  label: string;
  node_type: string;
  modality: string;
  status: string;
  dependencies: string[];
}

export interface DAGNodeItem {
  id: string;
  label: string;
  node_type: string;
  modality: string;
  status: string;
  capability_id?: string;
  model_id?: string;
  asset_id?: string;
  asset_filename?: string;
  estimated_ram_mb: number;
  estimated_latency_ms: number;
  dependencies: string[];
}

export interface DAGEdgeItem {
  from_node: string;
  to_node: string;
  relationship: string;
}

export interface ExecutionDAGData {
  nodes: DAGNodeItem[];
  edges: DAGEdgeItem[];
  topological_order: string[];
  total_nodes: number;
  total_edges: number;
}

export interface ResourceSnapshotData {
  total_ram_mb: number;
  available_ram_mb: number;
  used_ram_mb: number;
  ram_usage_percent: number;
  cpu_cores: number;
  cuda_available: boolean;
  gpu_count: number;
  gpu_name?: string | null;
  total_vram_mb: number;
  available_vram_mb: number;
  allocated_vram_mb: number;
}

export interface OrchestrationPlan {
  id: string;
  case_id: string;
  patient_id: string;
  status: string;
  input_modalities: string[];
  symptoms_context?: string | null;
  selected_models: SelectedModelItem[];
  skipped_capabilities: SkippedCapabilityItem[];
  execution_order: ExecutionStepItem[];
  dag: ExecutionDAGData;
  selection_reasons: Record<string, string>;
  resource_snapshot: ResourceSnapshotData;
  summary: string;
  created_at: string;
  updated_at: string;
}

// ==========================================
// PHASE 8: RESOURCE SCHEDULER TYPES
// ==========================================

export interface HardwareTelemetryData {
  cpu_percent: number;
  cpu_cores: number;
  total_ram_mb: number;
  available_ram_mb: number;
  used_ram_mb: number;
  ram_usage_percent: number;
  cuda_available: boolean;
  gpu_count: number;
  gpu_name?: string | null;
  total_vram_mb: number;
  available_vram_mb: number;
  allocated_vram_mb: number;
  timestamp: string;
}

export interface SimulatedLimitsConfig {
  enabled: boolean;
  simulated_max_ram_mb: number | null;
  simulated_max_vram_mb: number | null;
  simulated_artificial_delay_ms: number;
  label: string; // "SIMULATED_RESOURCE_LIMIT"
}

export interface LoadedModelEntry {
  capability_id: string;
  model_name: string;
  estimated_ram_mb: number;
  estimated_vram_mb: number;
  loaded_at: number;
  last_accessed_at: number;
  load_time_ms: number;
  access_count: number;
  device: string;
}

export interface ModelCacheStatus {
  max_resident_models: number;
  max_resident_ram_mb: number;
  total_resident_ram_mb: number;
  resident_models_count: number;
  hits: number;
  misses: number;
  evictions: number;
  resident_models: LoadedModelEntry[];
}

export interface CapabilityMemoryEstimate {
  capability_id: string;
  name: string;
  modality: string;
  model_id: string;
  estimated_ram_mb: number;
  estimated_vram_mb: number;
  expected_latency_ms: number;
  status: string;
}

export interface TaskQueueItem {
  task_id: string;
  capability_id: string;
  model_id: string;
  case_id?: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout' | string;
  queued_at: number;
  started_at?: number | null;
  completed_at?: number | null;
  runtime_ms?: number | null;
  error_message?: string | null;
}

export interface TaskQueueStatus {
  max_concurrency: number;
  active_tasks_count: number;
  running_count: number;
  queued_count: number;
  total_completed: number;
  total_timeouts: number;
  active_tasks: TaskQueueItem[];
}

export interface SchedulerEventItem {
  id: string;
  case_id?: string | null;
  capability_id: string;
  model_id: string;
  stage: 'SELECT' | 'RESOURCE_CHECK' | 'LOAD' | 'INFER' | 'PERSIST' | 'CACHE' | 'UNLOAD' | 'ERROR' | string;
  status: 'started' | 'success' | 'failed' | 'skipped' | string;
  latency_ms?: number | null;
  ram_mb?: number | null;
  vram_mb?: number | null;
  is_simulated: boolean;
  error_code?: string | null;
  details?: Record<string, unknown> | null;
  timestamp: string;
}

export interface SchedulerDashboardData {
  telemetry: HardwareTelemetryData;
  simulated_limits: SimulatedLimitsConfig;
  cache: ModelCacheStatus;
  queue: TaskQueueStatus;
  memory_estimates: CapabilityMemoryEstimate[];
  recent_events: SchedulerEventItem[];
}

// ==============================================================================
// Phase 9: Patient-Centric RAG & Clinical Knowledge Store
// ==============================================================================

export interface RetrievedEvidenceItem {
  id: string;
  patient_id: string;
  document_id?: string | null;
  case_id?: string | null;
  content: string;
  clean_content?: string | null;
  document_type: string;
  event_date: string;
  page_number: number;
  domain: string;
  filename: string;
  chunk_index: number;
  source_path?: string | null;
  metadata?: Record<string, unknown>;
  similarity: number;
  temporal_category?: 'CURRENT' | 'HISTORICAL';
  days_offset?: number | null;
}

export interface EvidenceSearchResponse {
  patient_id: string;
  query: string;
  total_retrieved: number;
  evidence: RetrievedEvidenceItem[];
}

export interface PatientKnowledgeChunk {
  id: string;
  patient_id: string;
  document_id?: string | null;
  case_id?: string | null;
  content: string;
  clean_content?: string | null;
  document_type: string;
  event_date: string;
  page_number: number;
  domain: string;
  filename: string;
  chunk_index: number;
  source_path?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface PatientKnowledgeResponse {
  patient_id: string;
  total_chunks: number;
  chunks: PatientKnowledgeChunk[];
}

export interface RAGIngestResponse {
  patient_id: string;
  filename: string;
  document_type: string;
  total_chunks: number;
  chunks_created: number;
  message: string;
}

// ==============================================================================
// Phase 10: Gemini Evidence-Language Layer
// ==============================================================================

export interface GeminiStatusResponse {
  status: 'READY' | 'API_KEY_REQUIRED' | 'ERROR';
  model: string;
  message: string;
  supported_actions: string[];
}

export interface ConflictItem {
  finding_or_claim: string;
  source_a: string;
  source_b: string;
  conflict_description: string;
  clinical_significance?: string | null;
}

export interface GeminiSynthesisResult {
  result_type: 'GENERATED_SYNTHESIS' | string;
  action: string;
  generated_synthesis: string;
  summary?: string | null;
  supporting_evidence_ids: string[];
  uncertainty_notes: string[];
  conflicts: ConflictItem[];
  suggested_review_questions: string[];
  clinical_correlations: string[];
  is_grounded: boolean;
  model_used: string;
  timestamp: string;
}

export interface ModelFindingBundleItem {
  finding_id?: string | null;
  model_id: string;
  capability: string;
  finding: string;
  confidence?: number | null;
  severity?: string | null;
  run_id?: string | null;
  provenance_id?: string | null;
}

export interface RetrievedEvidenceBundleItem {
  id: string;
  content: string;
  filename: string;
  page_number: number;
  event_date?: string | null;
  document_type: string;
  domain?: string | null;
  similarity?: number | null;
}

export interface PatientContextBundle {
  patient_id: string;
  name?: string | null;
  age?: number | null;
  gender?: string | null;
  chronic_conditions?: string[];
  allergies?: string[];
  chief_complaint?: string | null;
  symptoms?: string | null;
}

export interface StructuredEvidenceBundle {
  patient_context: PatientContextBundle;
  model_findings?: ModelFindingBundleItem[];
  patient_records?: Record<string, unknown>[];
  retrieved_evidence?: RetrievedEvidenceBundleItem[];
  trusted_knowledge?: string[];
  provenance_ids?: string[];
  uncertainty?: Record<string, unknown>;
  conflict_flags?: Record<string, unknown>[];
  custom_instructions?: string | null;
}

export interface GeminiSynthesisRequest {
  action: string;
  evidence_bundle: StructuredEvidenceBundle;
  document_text?: string | null;
}

// ==============================================================================
// Phase 11: Canonical Evidence System Types
// ==============================================================================

export type CanonicalEvidenceType =
  | 'MODEL_FINDING'
  | 'PATIENT_RECORD'
  | 'TRUSTED_KNOWLEDGE'
  | 'GENERATED_SYNTHESIS';

export type CanonicalEvidenceLinkType =
  | 'SUPPORTS'
  | 'CONTRADICTS'
  | 'CONTEXTUALIZES'
  | 'DERIVED_FROM';

export type FindingSeverity =
  | 'NORMAL'
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'CRITICAL';

export type FindingStatus =
  | 'DETECTED'
  | 'RULED_OUT'
  | 'EQUIVOCAL'
  | 'PENDING_REVIEW';

export interface ProvenanceRecord {
  evidence_type: CanonicalEvidenceType;
  model_id?: string;
  model_name?: string;
  model_run_id?: string;
  source_asset_id?: string;
  source_asset_filename?: string;
  modality?: string;
  document_id?: string;
  document_filename?: string;
  page_number?: number;
  chunk_id?: string;
  chunk_index?: number;
  domain?: string;
  event_date?: string;
  source_name?: string;
  document_title?: string;
  citation_reference?: string;
  generator?: string;
  supporting_evidence_ids?: string[];
  trace_path: string[];
}

export interface CanonicalEvidenceItem {
  id: string;
  case_id?: string;
  patient_id: string;
  evidence_type: CanonicalEvidenceType;
  title: string;
  summary: string;
  content?: string;
  confidence?: number;
  modality?: string;
  event_date?: string;
  provenance: ProvenanceRecord;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CanonicalEvidenceLink {
  id: string;
  case_id?: string;
  source_id: string;
  source_type: string;
  target_evidence_id: string;
  target_evidence_type: CanonicalEvidenceType;
  link_type: CanonicalEvidenceLinkType;
  rationale?: string;
  created_at: string;
}

export interface CanonicalFinding {
  id: string;
  case_id: string;
  patient_id: string;
  label: string;
  severity: FindingSeverity;
  status: FindingStatus;
  confidence?: number;
  source_evidence_type: CanonicalEvidenceType;
  primary_evidence_id?: string;
  supporting_evidence_ids: string[];
  provenance: ProvenanceRecord;
  clinical_notes?: string;
  created_at: string;
}

export interface CanonicalCaseEvidenceGraph {
  case_id: string;
  patient_id: string;
  evidence_items: CanonicalEvidenceItem[];
  findings: CanonicalFinding[];
  links: CanonicalEvidenceLink[];
  stats: {
    total_evidence_items: number;
    model_findings_count: number;
    patient_records_count: number;
    trusted_knowledge_count: number;
    generated_synthesis_count: number;
    findings_count: number;
    links_count: number;
  };
}

// ==============================================================================
// Phase 12: Structured Conflict Detection & Review States
// ==============================================================================

export type ConflictCategory =
  | 'MODEL_DISAGREEMENT'
  | 'MODEL_VS_HISTORY'
  | 'HISTORICAL_CONTRADICTION'
  | 'MISSING_EVIDENCE'
  | 'POOR_IMAGE_QUALITY'
  | 'UNSUPPORTED_MODALITY'
  | 'INCOMPLETE_CASE_CONTEXT';

export type ReviewState =
  | 'CLEAR'
  | 'REVIEW_REQUIRED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'MODEL_DISAGREEMENT'
  | 'INPUT_QUALITY_ISSUE';

export type ConflictSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface EvidenceComparisonAnchor {
  id: string;
  title: string;
  source_type: string;
  summary: string;
  excerpt?: string | null;
  confidence?: number | null;
  provenance_trace: string[];
}

export interface StructuredConflictItem {
  id: string;
  case_id: string;
  patient_id: string;
  conflict_type: ConflictCategory;
  review_state: ReviewState;
  severity: ConflictSeverity;
  title: string;
  explanation: string;
  evidence_a: EvidenceComparisonAnchor;
  evidence_b: EvidenceComparisonAnchor;
  clinical_implication?: string | null;
  why_human_review_required: string;
  recommended_action: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | string;
  resolution_notes?: string | null;
  created_at: string;
}

export interface DimensionMetrics {
  model_confidence?: number | null;
  cross_model_agreement?: number | null;
  historical_support?: number | null;
  evidence_completeness: number;
  input_quality: number;
}

export interface CaseReviewAssessment {
  case_id: string;
  patient_id: string;
  review_state: ReviewState;
  human_review_required: boolean;
  primary_review_reason: string;
  review_reasons: string[];
  dimensions: DimensionMetrics;
  conflicts: StructuredConflictItem[];
  conflicts_count: number;
  created_at: string;
  updated_at: string;
}

// ==========================================
// PHASE 13: REAL-TIME ORCHESTRATION GRAPH TYPES
// ==========================================

export type OrchestrationState = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'REVIEW_REQUIRED';

export type OrchestrationEventType =
  | 'case_accepted'
  | 'asset_inspection'
  | 'rag_retrieval'
  | 'capability_selection'
  | 'model_selection'
  | 'resource_check'
  | 'model_load'
  | 'inference'
  | 'evidence_creation'
  | 'conflict_detection'
  | 'gemini_synthesis'
  | 'report_generation'
  | 'error'
  | 'review_required';

export type GraphStageNode =
  | 'CASE'
  | 'INPUTS'
  | 'CAPABILITY_SELECTION'
  | 'RESOURCE_CHECK'
  | 'SPECIALIZED_MODEL'
  | 'MODEL_FINDING'
  | 'EVIDENCE'
  | 'CONFLICT_UNCERTAINTY'
  | 'GEMINI'
  | 'REPORT';

export interface OrchestrationEventItem {
  id: string;
  run_id: string;
  case_id: string;
  patient_id: string;
  event_type: OrchestrationEventType;
  stage_node: GraphStageNode;
  state: OrchestrationState;
  title: string;
  message: string;
  sequence: number;
  duration_ms?: number | null;
  payload: Record<string, any>;
  created_at: string;
}

export interface GraphNodeState {
  id: string;
  node_type: GraphStageNode;
  label: string;
  sublabel?: string | null;
  state: OrchestrationState;
  duration_ms?: number | null;
  summary?: string | null;
  details: Record<string, any>;
  updated_at?: string | null;
}

export interface GraphEdgeState {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  status: 'idle' | 'active' | 'completed' | 'error' | 'review' | string;
}

export interface ReconstructedGraphState {
  run_id: string;
  case_id: string;
  patient_id: string;
  overall_state: OrchestrationState;
  active_stage?: string | null;
  nodes: GraphNodeState[];
  edges: GraphEdgeState[];
  events: OrchestrationEventItem[];
  total_duration_ms: number;
  completed_nodes_count: number;
  total_nodes_count: number;
  has_review_required: boolean;
  review_reasons: string[];
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrchestrationRunSummary {
  id: string;
  case_id: string;
  patient_id: string;
  state: OrchestrationState;
  active_stage: string;
  total_events: number;
  error_message?: string | null;
  review_reasons: string[];
  created_at: string;
  completed_at?: string | null;
}

// ==============================================================================
// Phase 15: Clinician-Facing Screening Report / Clinical Intelligence Summary
// ==============================================================================

export type EvidenceLabelType =
  | 'MODEL FINDING'
  | 'PATIENT RECORD'
  | 'TRUSTED KNOWLEDGE'
  | 'GENERATED SYNTHESIS';

export interface PatientContextSection {
  patient_id: string;
  mrn: string;
  full_name: string;
  age?: number | null;
  gender?: string | null;
  blood_type?: string | null;
  primary_condition?: string | null;
  allergies: string[];
  active_medications: string[];
  recent_vitals: Record<string, any>;
}

export interface CaseContextSection {
  case_id: string;
  case_number?: string | null;
  title: string;
  status: string;
  priority: string;
  chief_complaint: string;
  symptoms: string[];
  clinical_notes?: string | null;
  admission_date?: string | null;
}

export interface InputModalityItem {
  asset_id: string;
  filename: string;
  modality: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256?: string | null;
  quality_status: string;
  storage_path?: string | null;
}

export interface SelectedModelItem {
  model_id: string;
  name: string;
  version: string;
  capability: string;
  modality: string;
  operating_threshold: number;
  execution_state: string;
  device: string;
  runtime_seconds?: number | null;
}

export interface ModelFindingItem {
  finding_id: string;
  evidence_label: EvidenceLabelType;
  capability: string;
  pathology: string;
  probability: number;
  threshold: number;
  is_positive: boolean;
  severity: string;
  source_asset_id?: string | null;
  source_asset_filename?: string | null;
  model_name: string;
  model_run_id?: string | null;
}

export interface PatientHistoryItem {
  record_id: string;
  evidence_label: EvidenceLabelType;
  category: string;
  description: string;
  documented_date?: string | null;
  source_document?: string | null;
  verified_by_clinician: boolean;
}

export interface ReportRetrievedEvidenceItem {
  chunk_id: string;
  evidence_label: EvidenceLabelType;
  document_title: string;
  document_type: string;
  page_number: number;
  chunk_index: number;
  similarity_score: number;
  content_excerpt: string;
  provenance_hash?: string | null;
}

export interface CrossModalObservationItem {
  observation_id: string;
  title: string;
  modalities_involved: string[];
  correlation_type: string;
  clinical_narrative: string;
  significance_level: string;
}

export interface ReportConflictSectionItem {
  conflict_id: string;
  conflict_type: string;
  severity: string;
  status: string;
  source_a_label: string;
  source_a_claim: string;
  source_b_label: string;
  source_b_claim: string;
  clinical_significance: string;
  resolution_notes?: string | null;
}

export interface UncertaintySection {
  overall_uncertainty_tier: string;
  model_calibration_notes: string[];
  missing_modalities: string[];
  image_quality_caveats: string[];
  evidence_completeness_ratio: number;
  explicit_data_gaps: string[];
  clinical_disclaimer: string;
}

export interface ReviewStatusSection {
  review_state: string;
  urgency_tier: string;
  requires_specialist_consult: boolean;
  recommended_specialty?: string | null;
  is_signed_off: boolean;
  signed_by_name?: string | null;
  signed_by_role?: string | null;
  signed_at?: string | null;
}

export interface ProvenanceTraceItem {
  trace_id: string;
  target_finding: string;
  source_origin: string;
  asset_reference: string;
  sha256_verification: string;
  timestamp: string;
}

export interface GeneratedSynthesisSection {
  synthesis_id: string;
  evidence_label: EvidenceLabelType;
  executive_summary: string;
  detailed_synthesis: string;
  supporting_evidence_ids: string[];
  clinical_correlations: string[];
  targeted_physician_questions: string[];
  generated_at: string;
}

export interface ReviewNotesSection {
  notes_id?: string | null;
  clinician_comments?: string | null;
  diagnostic_disposition?: string | null;
  sign_off_status: string;
  clinician_name?: string | null;
  clinician_signature?: string | null;
  updated_at?: string | null;
}

export interface ClinicalIntelligenceSummary {
  id: string;
  title: string;
  report_type: string;
  patient_id: string;
  case_id: string;
  status: string;
  review_status: string;
  uncertainty_level: string;
  created_at: string;
  updated_at: string;

  // The 14 Required Sections
  patient_context: PatientContextSection;
  case_context: CaseContextSection;
  input_modalities: InputModalityItem[];
  selected_models: SelectedModelItem[];
  model_findings: ModelFindingItem[];
  patient_history: PatientHistoryItem[];
  retrieved_evidence: ReportRetrievedEvidenceItem[];
  cross_modal_observations: CrossModalObservationItem[];
  conflicts: ReportConflictSectionItem[];
  uncertainty: UncertaintySection;
  review_status_details: ReviewStatusSection;
  provenance: ProvenanceTraceItem[];
  generated_synthesis: GeneratedSynthesisSection;
  review_notes: ReviewNotesSection;
}

export interface ScreeningReportSignOffRequest {
  review_notes: string;
  diagnostic_disposition?: string | null;
  sign_off_status: string;
  clinician_signature: string;
  clinician_name?: string | null;
}

// ==============================================================================
// Phase 16: Model Council, Evidence Sensitivity & Imaging Explainability Types
// ==============================================================================

export interface CouncilModelEvaluation {
  model_id: string;
  model_name: string;
  capability: string;
  modality: string;
  version: string;
  status: 'EVALUATED' | 'MISSING_MODEL' | string;
  is_missing: boolean;
  missing_reason?: string | null;
  finding_label?: string | null;
  probability?: number | null;
  threshold?: number | null;
  detected?: boolean | null;
  severity?: string | null;
  runtime_ms?: number | null;
  device?: string | null;
  provenance?: Record<string, unknown> | null;
}

export interface CouncilAgreement {
  finding_domain: string;
  concordance_type: 'CONCORDANT_POSITIVE' | 'CONCORDANT_NEGATIVE' | 'HIGH_CONCORDANCE' | string;
  participating_models: string[];
  description: string;
  confidence_delta: number;
}

export interface CouncilDisagreement {
  finding_domain: string;
  divergence_type: 'THRESHOLD_CROSSING' | 'SEVERITY_MISMATCH' | 'LOCALIZATION_DISPUTE' | string;
  model_a_id: string;
  model_a_finding: string;
  model_a_probability: number;
  model_b_id: string;
  model_b_finding: string;
  model_b_probability: number;
  divergence_reason: string;
  recommended_clinical_action: string;
}

export interface ModelCouncilResult {
  case_id: string;
  asset_id: string;
  modality: string;
  is_ambiguous: boolean;
  ambiguity_rationale: string;
  evaluated_models_count: number;
  missing_models_count: number;
  model_evaluations: CouncilModelEvaluation[];
  agreements: CouncilAgreement[];
  disagreements: CouncilDisagreement[];
  missing_models: CouncilModelEvaluation[];
  council_verdict: string;
  consensus_status: 'CONSENSUS_REACHED' | 'SPLIT_OPINION' | 'INCONCLUSIVE' | 'MISSING_REPRESENTATION' | string;
  deliberation_timestamp: string;
}

export interface EvidenceContributionItem {
  evidence_id: string;
  evidence_type: string;
  title: string;
  excerpt: string;
  source_provenance: string;
  contribution_weight: number;
  contribution_percentage: number;
  contribution_level: 'PRIMARY' | 'SECONDARY' | 'CONTEXTUAL' | string;
  influence_nature: 'SUPPORTIVE' | 'QUALIFYING' | 'CONTRADICTORY' | string;
  synthesis_attribution_segments: string[];
}

export interface EvidenceSensitivityAssessment {
  case_id: string;
  synthesis_id?: string | null;
  synthesis_preview: string;
  total_contributing_items: number;
  primary_contributors_count: number;
  contributions: EvidenceContributionItem[];
  non_causal_disclaimer: string;
  assessment_timestamp: string;
}

export interface ImagingExplainabilityResult {
  label: string;
  is_available: boolean;
  unavailability_reason?: string | null;
  asset_id: string;
  case_id?: string | null;
  target_pathology: string;
  model_id?: string | null;
  model_version?: string | null;
  target_layer?: string | null;
  method: string;
  calibrated_probability?: number | null;
  peak_activation_coords?: [number, number] | null;
  activation_coverage_pct?: number | null;
  heatmap_png_base64?: string | null;
  overlay_png_base64?: string | null;
  authenticity_statement: string;
}

