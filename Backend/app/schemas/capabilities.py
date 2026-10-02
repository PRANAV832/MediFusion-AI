from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ClinicalCapabilityResponse(BaseModel):
    capability_id: str = Field(..., description="Unique slug for the capability (e.g. 'pneumonia_screening')")
    name: str = Field(..., description="Clinical display name")
    description: str = Field(..., description="Detailed clinical description of the capability")
    expected_modality: str = Field(..., description="Target medical modality (e.g. 'chest_xray', 'mri', 'ct', 'ecg', 'skin_image')")
    adapter_class: str = Field(..., description="Python adapter class implementing MedicalModel")
    preprocessing_contract: Dict[str, Any] = Field(default_factory=dict, description="Input dimensions, channels, normalization, color space")
    output_schema: Dict[str, Any] = Field(default_factory=dict, description="Output classes, probabilities, thresholds, prediction types")
    model_source: str = Field(..., description="Download repository, paper, or model zoo origin")
    provenance: Dict[str, Any] = Field(default_factory=dict, description="Authors, citations, datasets, frameworks")
    limitations: List[str] = Field(default_factory=list, description="Clinical safety limits, contraindications, and caveats")
    license: str = Field(..., description="Code and weights license designation")
    status: str = Field(..., description="'ready' if verified and runnable, or 'not_configured'")
    model_id: Optional[str] = Field(None, description="Linked model identifier in model_registry")
    verification_details: Dict[str, Any] = Field(default_factory=dict, description="9-point verification checklist inspection")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CapabilityResolveResponse(BaseModel):
    modality: str
    runnable_only: bool = False
    capabilities: List[ClinicalCapabilityResponse] = Field(default_factory=list)
    count: int


class CapabilityHealthResponse(BaseModel):
    capability_id: str
    status: str
    runtime_ready: bool
    device: str
    weights_present: bool
    dependencies_ready: bool
    verification_details: Dict[str, Any] = Field(default_factory=dict)
    last_verified_at: str
