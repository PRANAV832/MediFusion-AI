from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

NON_CAUSAL_DISCLAIMER = (
    "NON-CAUSAL DISCLAIMER: Evidence sensitivity metrics represent algorithmic attribution and textual "
    "grounding weights within the generated clinical intelligence summary. They DO NOT establish biological "
    "etiology, medical causation, or diagnostic certainty. All clinical interpretations require validated physician evaluation."
)


class EvidenceContributionItem(BaseModel):
    """Grounded contribution of a single evidence item to the generated synthesis."""
    evidence_id: str
    evidence_type: str = Field(
        ...,
        description="MODEL_FINDING, PATIENT_RECORD, or TRUSTED_KNOWLEDGE"
    )
    title: str
    excerpt: str
    source_provenance: str
    contribution_weight: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Normalized relative contribution weight (0.0 to 1.0)"
    )
    contribution_percentage: float = Field(
        ...,
        description="Percentage of total evidence attribution (sums to ~100%)"
    )
    contribution_level: str = Field(
        ...,
        description="PRIMARY, SECONDARY, or CONTEXTUAL"
    )
    influence_nature: str = Field(
        ...,
        description="SUPPORTIVE, QUALIFYING, or CONTRADICTORY"
    )
    synthesis_attribution_segments: List[str] = Field(
        default_factory=list,
        description="Specific phrases or clauses in the synthesis supported by this evidence"
    )


class EvidenceSensitivityAssessment(BaseModel):
    """Sensitivity analysis mapping evidence grounding to generated clinical synthesis."""
    case_id: str
    synthesis_id: Optional[str] = None
    synthesis_preview: str
    total_contributing_items: int
    primary_contributors_count: int
    contributions: List[EvidenceContributionItem]
    non_causal_disclaimer: str = Field(
        default=NON_CAUSAL_DISCLAIMER,
        description="Strict disclaimer prohibiting claims of causal certainty"
    )
    assessment_timestamp: str
