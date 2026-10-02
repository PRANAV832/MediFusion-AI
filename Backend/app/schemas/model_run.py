from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ModelStatusEnum(str, Enum):
    READY = "READY"
    NOT_CONFIGURED = "NOT_CONFIGURED"
    MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE"
    ERROR = "ERROR"


class ModelFinding(BaseModel):
    pathology: str
    probability: float = Field(ge=0.0, le=1.0)
    detected: bool
    threshold: float
    ppv80_threshold: Optional[float] = None
    severity: Optional[str] = None


class ModelProvenance(BaseModel):
    model_name: str
    architecture: str
    weights_source: str
    weights_hash: Optional[str] = None
    training_datasets: List[str] = Field(default_factory=list)
    citation: str
    license: str
    input_dimensions: str
    normalization_range: str
    input_asset_filename: Optional[str] = None
    input_asset_sha256: Optional[str] = None
    execution_timestamp: str
    torch_version: str
    torchxrayvision_version: str
    device: str


class NormalizedInferenceResult(BaseModel):
    model_id: str
    model_version: str
    capability: str
    input_asset_id: str
    findings: List[ModelFinding] = Field(default_factory=list)
    scores: Dict[str, float] = Field(default_factory=dict)
    runtime_ms: float
    device: str
    provenance: ModelProvenance
    limitations: List[str] = Field(default_factory=list)


class ModelRunRequest(BaseModel):
    asset_id: str
    capability_id: Optional[str] = Field(default=None, description="Clinical capability to execute (e.g. 'pneumonia_screening')")
    model_id: Optional[str] = Field(default=None, description="Optional explicit model ID (e.g. 'torchxrayvision-densenet121')")


class ModelRunResponse(BaseModel):
    id: str
    case_id: str
    patient_id: str
    asset_id: str
    model_id: str
    model_version: str
    capability: str
    status: str
    findings: List[ModelFinding] = Field(default_factory=list)
    scores: Dict[str, float] = Field(default_factory=dict)
    runtime_ms: float
    device: str
    provenance: Dict[str, Any] = Field(default_factory=dict)
    limitations: List[str] = Field(default_factory=list)
    error_message: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime


class ModelStatusResponse(BaseModel):
    model_id: str
    model_version: str
    capability: str
    status: ModelStatusEnum
    status_message: str
    device: str
    gpu_available: bool
    weights_available: bool
    dependencies_installed: bool
    pathologies: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
