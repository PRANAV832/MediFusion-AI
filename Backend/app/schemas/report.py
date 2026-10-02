from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class EvidenceLabel(str, Enum):
    MODEL_FINDING = "MODEL FINDING"
    PATIENT_RECORD = "PATIENT RECORD"
    TRUSTED_KNOWLEDGE = "TRUSTED KNOWLEDGE"
    GENERATED_SYNTHESIS = "GENERATED SYNTHESIS"


# ------------------------------------------------------------------------------
# 14 REQUIRED CLINICAL SCREENING SECTIONS
# ------------------------------------------------------------------------------

class PatientContextSection(BaseModel):
    """Section 1: Demographics, known chronic conditions, vitals, allergies."""
    patient_id: str
    mrn: str
    full_name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    primary_condition: Optional[str] = None
    allergies: List[str] = Field(default_factory=list)
    active_medications: List[str] = Field(default_factory=list)
    recent_vitals: Dict[str, Any] = Field(default_factory=dict)


class CaseContextSection(BaseModel):
    """Section 2: Active encounter intake data, chief complaint, priority."""
    case_id: str
    case_number: Optional[str] = None
    title: str
    status: str
    priority: str
    chief_complaint: str
    symptoms: List[str] = Field(default_factory=list)
    clinical_notes: Optional[str] = None
    admission_date: Optional[datetime] = None


class InputModalityItem(BaseModel):
    """Section 3: Ingested file assets across modalities."""
    asset_id: str
    filename: str
    modality: str  # chest_xray, ecg, mri, ct, lab_report, clinical_note
    mime_type: str
    size_bytes: int
    checksum_sha256: Optional[str] = None
    quality_status: str = "VERIFIED"  # VERIFIED, DEGRADED, POOR_CONTRAST, ARTIFACT_DETECTED
    storage_path: Optional[str] = None


class SelectedModelItem(BaseModel):
    """Section 4: Specialized AI models selected & executed."""
    model_id: str
    name: str
    version: str
    capability: str
    modality: str
    operating_threshold: float = 0.50
    execution_state: str = "COMPLETED"  # COMPLETED, FAILED, RUNNING, NOT_APPLICABLE
    device: str = "cpu"
    runtime_seconds: Optional[float] = None


class ModelFindingItem(BaseModel):
    """Section 5: Specialized model inference findings (labeled: MODEL FINDING)."""
    finding_id: str
    evidence_label: EvidenceLabel = EvidenceLabel.MODEL_FINDING
    capability: str
    pathology: str
    probability: float
    threshold: float
    is_positive: bool
    severity: str = "low"  # low, medium, high, critical
    source_asset_id: Optional[str] = None
    source_asset_filename: Optional[str] = None
    model_name: str
    model_run_id: Optional[str] = None


class PatientHistoryItem(BaseModel):
    """Section 6: Documented historical record items (labeled: PATIENT RECORD)."""
    record_id: str
    evidence_label: EvidenceLabel = EvidenceLabel.PATIENT_RECORD
    category: str  # chronic_condition, prior_admission, surgery, pathology
    description: str
    documented_date: Optional[str] = None
    source_document: Optional[str] = None
    verified_by_clinician: bool = True


class RetrievedEvidenceItem(BaseModel):
    """Section 7: Vector-retrieved historical evidence chunks (labeled: PATIENT RECORD or TRUSTED KNOWLEDGE)."""
    chunk_id: str
    evidence_label: EvidenceLabel = EvidenceLabel.PATIENT_RECORD
    document_title: str
    document_type: str
    page_number: int
    chunk_index: int
    similarity_score: float
    content_excerpt: str
    provenance_hash: Optional[str] = None


class CrossModalObservationItem(BaseModel):
    """Section 8: Inter-modality correlation across imaging, biosignals, and notes."""
    observation_id: str
    title: str
    modalities_involved: List[str]
    correlation_type: str  # CORROBORATING, DISCREPANT, UNRELATED, REINFORCING
    clinical_narrative: str
    significance_level: str = "MODERATE"  # LOW, MODERATE, HIGH, CRITICAL


class ConflictSectionItem(BaseModel):
    """Section 9: Structured conflict detections between findings, models, and history."""
    conflict_id: str
    conflict_type: str  # MODEL_DISAGREEMENT, MODEL_VS_HISTORY, HISTORICAL_DISCREPANCY, QUALITY_ALERT
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    status: str = "OPEN"  # OPEN, RESOLVED, DISMISSED, ACKNOWLEDGED
    source_a_label: str
    source_a_claim: str
    source_b_label: str
    source_b_claim: str
    clinical_significance: str
    resolution_notes: Optional[str] = None


class UncertaintySection(BaseModel):
    """Section 10: Explicit clinical uncertainty breakdown (NEVER HIDDEN, NEVER FAKE SCORE)."""
    overall_uncertainty_tier: str = "MODERATE"  # LOW, MODERATE, HIGH, ELEVATED
    model_calibration_notes: List[str] = Field(default_factory=list)
    missing_modalities: List[str] = Field(default_factory=list)
    image_quality_caveats: List[str] = Field(default_factory=list)
    evidence_completeness_ratio: float = 1.0
    explicit_data_gaps: List[str] = Field(default_factory=list)
    clinical_disclaimer: str = (
        "CONFIDENTIAL MEDICAL INTELLIGENCE: This automated screening report does not constitute a "
        "definitive diagnostic finding or final diagnosis. All probability scores and model inferences "
        "must be independently reviewed and verified by a licensed healthcare professional."
    )


class ReviewStatusSection(BaseModel):
    """Section 11: Case review status and safety determination."""
    review_state: str  # CLEAR, REVIEW_REQUIRED, INSUFFICIENT_EVIDENCE, MODEL_DISAGREEMENT, INPUT_QUALITY_ISSUE
    urgency_tier: str = "ROUTINE"  # ROUTINE, URGENT, STAT
    requires_specialist_consult: bool = False
    recommended_specialty: Optional[str] = None
    is_signed_off: bool = False
    signed_by_name: Optional[str] = None
    signed_by_role: Optional[str] = None
    signed_at: Optional[datetime] = None


class ProvenanceTraceItem(BaseModel):
    """Section 12: Cryptographic audit trace linking findings to source files."""
    trace_id: str
    target_finding: str
    source_origin: str  # Model Execution Run, RAG Document Chunk, Raw Sensor Asset
    asset_reference: str
    sha256_verification: str
    timestamp: datetime


class GeneratedSynthesisSection(BaseModel):
    """Section 13: Grounded clinical synthesis from Gemini (labeled: GENERATED SYNTHESIS)."""
    synthesis_id: str
    evidence_label: EvidenceLabel = EvidenceLabel.GENERATED_SYNTHESIS
    executive_summary: str
    detailed_synthesis: str
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    clinical_correlations: List[str] = Field(default_factory=list)
    targeted_physician_questions: List[str] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class ReviewNotesSection(BaseModel):
    """Section 14: Attending physician review notes, consultation remarks, and addenda."""
    notes_id: Optional[str] = None
    clinician_comments: Optional[str] = None
    diagnostic_disposition: Optional[str] = None  # e.g., "Corroborated with follow-up CT", "Rule out artifact"
    sign_off_status: str = "DRAFT"  # DRAFT, PRELIMINARY, REVIEWED, APPROVED, AMENDED
    clinician_name: Optional[str] = None
    clinician_signature: Optional[str] = None
    updated_at: Optional[datetime] = None


# ------------------------------------------------------------------------------
# FULL CLINICAL INTELLIGENCE SUMMARY / SCREENING REPORT SCHEMA
# ------------------------------------------------------------------------------

class ClinicalIntelligenceSummary(BaseModel):
    """Complete 14-Section Clinician-Facing Screening Report."""
    id: str
    title: str = Field(
        ...,
        description="Must be 'Screening Report' or 'Clinical Intelligence Summary'. Strictly NOT 'Final Diagnosis'."
    )
    report_type: str = "clinical_screening"
    patient_id: str
    case_id: str
    status: str = "preliminary"  # draft, preliminary, reviewed, approved
    review_status: str = "REVIEW_REQUIRED"
    uncertainty_level: str = "MODERATE"
    created_at: datetime
    updated_at: datetime

    # The 14 Mandatory Sections
    patient_context: PatientContextSection
    case_context: CaseContextSection
    input_modalities: List[InputModalityItem] = Field(default_factory=list)
    selected_models: List[SelectedModelItem] = Field(default_factory=list)
    model_findings: List[ModelFindingItem] = Field(default_factory=list)
    patient_history: List[PatientHistoryItem] = Field(default_factory=list)
    retrieved_evidence: List[RetrievedEvidenceItem] = Field(default_factory=list)
    cross_modal_observations: List[CrossModalObservationItem] = Field(default_factory=list)
    conflicts: List[ConflictSectionItem] = Field(default_factory=list)
    uncertainty: UncertaintySection
    review_status_details: ReviewStatusSection
    provenance: List[ProvenanceTraceItem] = Field(default_factory=list)
    generated_synthesis: GeneratedSynthesisSection
    review_notes: ReviewNotesSection

    @field_validator("title")
    @classmethod
    def validate_title_no_final_diagnosis(cls, v: str) -> str:
        prohibited = ["final diagnosis", "definitive diagnosis", "medical diagnosis score"]
        v_lower = v.lower()
        for p in prohibited:
            if p in v_lower:
                raise ValueError(
                    f"Report title '{v}' is prohibited. Use 'Screening Report' or 'Clinical Intelligence Summary'. "
                    "This system performs clinical screening support, NOT final diagnosis."
                )
        return v


class ScreeningReportSignOffRequest(BaseModel):
    """Payload for clinician signing off or appending review notes."""
    review_notes: str = Field(..., description="Clinician feedback or review notes")
    diagnostic_disposition: Optional[str] = Field(
        None,
        description="Clinician disposition: e.g., 'Approved for specialist workup', 'Artifact suspected', etc."
    )
    sign_off_status: str = Field(
        "APPROVED",
        description="Status: PRELIMINARY, REVIEWED, APPROVED, AMENDED"
    )
    clinician_signature: str = Field(..., description="Clinician digital signature or initials")
    clinician_name: Optional[str] = None


# ------------------------------------------------------------------------------
# LEGACY / BASIC COMPATIBILITY SCHEMAS
# ------------------------------------------------------------------------------

class ScreeningReportCreate(BaseModel):
    title: str = Field("Clinical Intelligence Summary", description="Report title")
    case_id: Optional[str] = None
    report_type: str = Field("clinical_screening", description="Type of screening report")
    findings_summary: Optional[str] = None
    recommendations: Optional[str] = None


class ScreeningReportResponse(BaseModel):
    id: str
    patient_id: str
    case_id: Optional[str] = None
    title: str
    report_type: str
    status: str
    findings_summary: Optional[str] = None
    recommendations: Optional[str] = None
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    structured_payload: Optional[Dict[str, Any]] = None
    review_status: Optional[str] = None
    uncertainty_level: Optional[str] = None
    clinician_signature: Optional[str] = None
