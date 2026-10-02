from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ModelFindingItem(BaseModel):
    finding_id: Optional[str] = None
    model_id: str
    capability: str
    finding: str
    confidence: Optional[float] = None
    severity: Optional[str] = None
    run_id: Optional[str] = None
    provenance_id: Optional[str] = None


class RetrievedEvidenceBundleItem(BaseModel):
    id: str = Field(..., description="Unique chunk/evidence provenance ID")
    content: str
    filename: str
    page_number: int = 1
    event_date: Optional[str] = None
    document_type: str = "clinical_note"
    domain: Optional[str] = None
    similarity: Optional[float] = None


class PatientContextBundle(BaseModel):
    patient_id: str
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    chronic_conditions: List[str] = Field(default_factory=list)
    allergies: List[str] = Field(default_factory=list)
    chief_complaint: Optional[str] = None
    symptoms: Optional[str] = None


class StructuredEvidenceBundle(BaseModel):
    """Input evidence bundle given to Gemini for bounded, grounded language synthesis."""
    patient_context: PatientContextBundle
    model_findings: List[ModelFindingItem] = Field(default_factory=list)
    patient_records: List[Dict[str, Any]] = Field(default_factory=list)
    retrieved_evidence: List[RetrievedEvidenceBundleItem] = Field(default_factory=list)
    trusted_knowledge: List[str] = Field(default_factory=list)
    provenance_ids: List[str] = Field(
        default_factory=list,
        description="Whitelist of valid evidence IDs that Gemini is permitted to cite"
    )
    uncertainty: Dict[str, Any] = Field(default_factory=dict)
    conflict_flags: List[Dict[str, Any]] = Field(default_factory=list)
    custom_instructions: Optional[str] = None


class GeminiSynthesisRequest(BaseModel):
    action: str = Field(
        default="evidence_grounded_synthesis",
        description="Action: document_extraction | clinical_history_summary | bounded_evidence_comparison | evidence_grounded_synthesis | screening_report_draft"
    )
    evidence_bundle: StructuredEvidenceBundle
    document_text: Optional[str] = Field(
        default=None,
        description="Raw document text if performing document_extraction"
    )


class ConflictItem(BaseModel):
    finding_or_claim: str
    source_a: str
    source_b: str
    conflict_description: str
    clinical_significance: Optional[str] = None


class GeminiSynthesisResult(BaseModel):
    """Structured JSON response returned by Gemini, strictly validated with Pydantic."""
    result_type: str = Field(
        default="GENERATED_SYNTHESIS",
        description="Mandatory tag designating output as generated synthesis"
    )
    action: str
    generated_synthesis: str = Field(
        ...,
        description="The evidence-grounded synthesis narrative or structured draft"
    )
    summary: Optional[str] = None
    supporting_evidence_ids: List[str] = Field(
        default_factory=list,
        description="List of cited provenance IDs verified against the input evidence bundle"
    )
    uncertainty_notes: List[str] = Field(
        default_factory=list,
        description="Explicit limitations, data gaps, or ambiguities"
    )
    conflicts: List[ConflictItem] = Field(
        default_factory=list,
        description="Identified contradictions or discrepancies between current findings and history"
    )
    suggested_review_questions: List[str] = Field(
        default_factory=list,
        description="Targeted clinical review questions for clinician review"
    )
    clinical_correlations: List[str] = Field(default_factory=list)
    is_grounded: bool = True
    model_used: str = "gemini-3.8-flash"
    timestamp: str


class GeminiStatusResponse(BaseModel):
    status: str = Field(..., description="READY | API_KEY_REQUIRED | ERROR")
    model: str
    message: str
    supported_actions: List[str] = Field(default_factory=list)
