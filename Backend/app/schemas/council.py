from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CouncilModelEvaluation(BaseModel):
    """Evaluation result for an individual specialized model in the council."""
    model_id: str
    model_name: str
    capability: str
    modality: str
    version: str
    status: str = Field(
        ...,
        description="EVALUATED or MISSING_MODEL"
    )
    is_missing: bool = False
    missing_reason: Optional[str] = None
    finding_label: Optional[str] = None
    probability: Optional[float] = None
    threshold: Optional[float] = None
    detected: Optional[bool] = None
    severity: Optional[str] = None
    runtime_ms: Optional[float] = None
    device: Optional[str] = None
    provenance: Optional[Dict[str, Any]] = None


class CouncilAgreement(BaseModel):
    """Concordant finding between two or more evaluated models."""
    finding_domain: str
    concordance_type: str = Field(
        ...,
        description="CONCORDANT_POSITIVE, CONCORDANT_NEGATIVE, or HIGH_CONCORDANCE"
    )
    participating_models: List[str]
    description: str
    confidence_delta: float = Field(
        ...,
        description="Absolute difference in probability between agreeing models"
    )


class CouncilDisagreement(BaseModel):
    """Divergent finding between evaluated models."""
    finding_domain: str
    divergence_type: str = Field(
        ...,
        description="THRESHOLD_CROSSING, SEVERITY_MISMATCH, or LOCALIZATION_DISPUTE"
    )
    model_a_id: str
    model_a_finding: str
    model_a_probability: float
    model_b_id: str
    model_b_finding: str
    model_b_probability: float
    divergence_reason: str
    recommended_clinical_action: str


class ModelCouncilResult(BaseModel):
    """Comprehensive deliberative assessment by the multi-model council."""
    case_id: str
    asset_id: str
    modality: str
    is_ambiguous: bool
    ambiguity_rationale: str
    evaluated_models_count: int
    missing_models_count: int
    model_evaluations: List[CouncilModelEvaluation]
    agreements: List[CouncilAgreement]
    disagreements: List[CouncilDisagreement]
    missing_models: List[CouncilModelEvaluation]
    council_verdict: str
    consensus_status: str = Field(
        ...,
        description="CONSENSUS_REACHED, SPLIT_OPINION, INCONCLUSIVE, or MISSING_REPRESENTATION"
    )
    deliberation_timestamp: str
