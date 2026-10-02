"""
MediFusion AI — Phase 12 Structured Conflict Detection Schemas
Defines structured conflict objects with explicit Evidence A vs Evidence B anchors,
strictly separated uncertainty dimensions, and canonical review states.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class ConflictCategory(str, Enum):
    MODEL_DISAGREEMENT = "MODEL_DISAGREEMENT"
    MODEL_VS_HISTORY = "MODEL_VS_HISTORY"
    HISTORICAL_CONTRADICTION = "HISTORICAL_CONTRADICTION"
    MISSING_EVIDENCE = "MISSING_EVIDENCE"
    POOR_IMAGE_QUALITY = "POOR_IMAGE_QUALITY"
    UNSUPPORTED_MODALITY = "UNSUPPORTED_MODALITY"
    INCOMPLETE_CASE_CONTEXT = "INCOMPLETE_CASE_CONTEXT"


class ReviewState(str, Enum):
    CLEAR = "CLEAR"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    MODEL_DISAGREEMENT = "MODEL_DISAGREEMENT"
    INPUT_QUALITY_ISSUE = "INPUT_QUALITY_ISSUE"


class ConflictSeverity(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class EvidenceComparisonAnchor(BaseModel):
    """
    Concrete anchor representing one side of an evidentiary contradiction.
    """
    id: str = Field(..., description="Evidence identifier or source reference")
    title: str = Field(..., description="Short descriptive label of the evidence claim")
    source_type: str = Field(..., description="MODEL_FINDING, PATIENT_RECORD, ASSET_METADATA, CLINICAL_CONTEXT")
    summary: str = Field(..., description="Core clinical claim or measurement")
    excerpt: Optional[str] = Field(None, description="Direct supporting quote or raw finding details")
    confidence: Optional[float] = Field(None, description="Genuinely produced model confidence if applicable")
    provenance_trace: List[str] = Field(default_factory=list, description="Trace path of the evidence item")


class StructuredConflictItem(BaseModel):
    """
    Explicit pairwise or contextual clinical conflict item comparing
    Evidence A vs Evidence B with clear human review rationale.
    """
    id: str = Field(..., description="Unique conflict identifier")
    case_id: str
    patient_id: str
    conflict_type: ConflictCategory
    review_state: ReviewState
    severity: ConflictSeverity = ConflictSeverity.MODERATE
    title: str = Field(..., description="High-level conflict title")
    explanation: str = Field(..., description="Clinical explanation of why Evidence A and Evidence B are in tension")
    evidence_a: EvidenceComparisonAnchor = Field(..., description="First evidentiary anchor")
    evidence_b: EvidenceComparisonAnchor = Field(..., description="Contradicting or tension anchor")
    clinical_implication: Optional[str] = Field(None, description="Potential safety or diagnostic impact")
    why_human_review_required: str = Field(..., description="Mandatory clinician rationale explaining necessity of human decision")
    recommended_action: str = Field(..., description="Suggested clinical resolution or next test")
    status: str = Field("OPEN", description="OPEN, ACKNOWLEDGED, RESOLVED")
    resolution_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DimensionMetrics(BaseModel):
    """
    Strictly separated evaluation dimensions.
    CRITICAL ARCHITECTURAL RULE:
    These five dimensions must NEVER be conflated into a single fake 'Diagnosis Confidence = 94%' score.
    Each measures an independent orthogonal axis of validity.
    """
    model_confidence: Optional[float] = Field(
        None, ge=0.0, le=1.0,
        description="Average genuine confidence of specialized model findings. None if no model inference run."
    )
    cross_model_agreement: Optional[float] = Field(
        None, ge=0.0, le=1.0,
        description="Concordance ratio between multiple specialized models. None if single model."
    )
    historical_support: Optional[float] = Field(
        None, ge=0.0, le=1.0,
        description="Proportion of acute findings that align with longitudinal patient records (0.0 = total contradiction, 1.0 = full alignment)."
    )
    evidence_completeness: float = Field(
        ..., ge=0.0, le=1.0,
        description="Proportion of required clinical intake fields and baseline modalities provided (0.0 to 1.0)."
    )
    input_quality: float = Field(
        ..., ge=0.0, le=1.0,
        description="Technical validity, pixel resolution, and integrity of ingested assets (0.0 = corrupt/unsupported, 1.0 = optimal)."
    )


class CaseReviewAssessment(BaseModel):
    """
    Full case conflict evaluation and clinician review determination.
    """
    case_id: str
    patient_id: str
    review_state: ReviewState
    human_review_required: bool
    primary_review_reason: str
    review_reasons: List[str] = Field(default_factory=list)
    dimensions: DimensionMetrics
    conflicts: List[StructuredConflictItem] = Field(default_factory=list)
    conflicts_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
