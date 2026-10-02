from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ModelRegistryBase(BaseModel):
    id: str = Field(..., description="Unique slug identifier (e.g. 'torchxrayvision-densenet121')")
    name: str = Field(..., description="Human-readable model name")
    version: str = Field(..., description="Semantic or architecture version")
    domain: str = Field(..., description="Clinical specialty domain (e.g. 'pulmonology', 'radiology')")
    modality: str = Field(..., description="Input medical modality (e.g. 'chest_xray', 'mri', 'ct', 'ecg')")
    capabilities: List[str] = Field(default_factory=list, description="Target screening capabilities")
    framework: str = Field(..., description="Underlying runtime framework ('pytorch', 'torchxrayvision', 'onnx')")
    artifact_source: str = Field(..., description="Source repository or download URL for weights")
    parameter_count: int = Field(default=0, description="Total trainable/frozen parameter count")
    estimated_ram_mb: int = Field(default=512, description="Estimated system RAM requirement in MB")
    estimated_vram_mb: int = Field(default=1024, description="Estimated accelerator VRAM requirement in MB")
    expected_latency_ms: int = Field(default=350, description="Expected inference latency in milliseconds")
    device_support: List[str] = Field(default_factory=lambda: ["cpu"], description="Supported compute devices ('cpu', 'cuda')")
    status: str = Field(default="ready", description="Registry status ('ready', 'active', 'not_configured', 'model_unavailable', 'error')")
    provenance: Dict[str, Any] = Field(default_factory=dict, description="Audit provenance metadata, citations, datasets")
    limitations: List[str] = Field(default_factory=list, description="Documented clinical contraindications and limitations")
    license: str = Field(..., description="Code and weights license designation")
    checksum: Optional[str] = Field(default=None, description="Cryptographic SHA-256 hash of model artifact")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Extended architectural metadata")


class ModelRegisterRequest(ModelRegistryBase):
    pass


class ModelUpdateRequest(BaseModel):
    name: Optional[str] = None
    version: Optional[str] = None
    domain: Optional[str] = None
    modality: Optional[str] = None
    capabilities: Optional[List[str]] = None
    framework: Optional[str] = None
    artifact_source: Optional[str] = None
    parameter_count: Optional[int] = None
    estimated_ram_mb: Optional[int] = None
    estimated_vram_mb: Optional[int] = None
    expected_latency_ms: Optional[int] = None
    device_support: Optional[List[str]] = None
    status: Optional[str] = None
    provenance: Optional[Dict[str, Any]] = None
    limitations: Optional[List[str]] = None
    license: Optional[str] = None
    checksum: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class ModelRegistryResponse(ModelRegistryBase):
    created_at: datetime
    updated_at: datetime
    runtime_status: Optional[str] = None


class ModelCompatibilityResponse(BaseModel):
    modality: str
    capability: Optional[str] = None
    compatible_models: List[ModelRegistryResponse] = Field(default_factory=list)
    count: int


class ModelHealthResponse(BaseModel):
    model_id: str
    status: str
    runtime_ready: bool
    device: str
    gpu_available: bool
    weights_present: bool
    dependencies_ready: bool
    last_verified_at: str
    details: Dict[str, Any] = Field(default_factory=dict)
