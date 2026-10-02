from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

EXPLAINABILITY_HEADER = "MODEL-SPECIFIC EXPLAINABILITY"


class ImagingExplainabilityResult(BaseModel):
    """
    Authentic model-specific explainability result derived directly from backpropagated gradients.
    Decorative heatmaps are strictly forbidden.
    """
    label: str = Field(
        default=EXPLAINABILITY_HEADER,
        description="Mandatory header labeling model-specific explainability"
    )
    is_available: bool = Field(
        ...,
        description="True if authentic gradient backpropagation succeeded; False if unavailable"
    )
    unavailability_reason: Optional[str] = None
    asset_id: str
    case_id: Optional[str] = None
    target_pathology: str
    model_id: Optional[str] = None
    model_version: Optional[str] = None
    target_layer: Optional[str] = None
    method: str = Field(
        default="Grad-CAM (Gradient-weighted Class Activation Mapping)",
        description="Authentic explainability methodology"
    )
    calibrated_probability: Optional[float] = None
    peak_activation_coords: Optional[Tuple[int, int]] = None
    activation_coverage_pct: Optional[float] = None
    heatmap_png_base64: Optional[str] = None
    overlay_png_base64: Optional[str] = None
    authenticity_statement: str = Field(
        default=(
            "MODEL-SPECIFIC EXPLAINABILITY: Derived directly from backpropagated gradients "
            "of TorchXRayVision DenseNet-121 layer features.denseblock4. This is an authentic "
            "gradient-weighted activation map, not a decorative or heuristic visualization."
        ),
        description="Mandatory declaration of non-decorative authenticity"
    )
