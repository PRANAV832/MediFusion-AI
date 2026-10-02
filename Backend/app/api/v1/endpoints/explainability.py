import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.schemas.explainability import (
    EXPLAINABILITY_HEADER,
    ImagingExplainabilityResult,
)
from app.services.explainability import ImagingExplainabilityService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/explainability", tags=["Imaging Explainability"])


class ExplainabilityRequest(BaseModel):
    asset_id: str
    target_pathology: str = "Pneumonia"
    case_id: Optional[str] = None


@router.post("/generate", response_model=ImagingExplainabilityResult)
async def generate_explainability(request: ExplainabilityRequest):
    """
    Generate authentic model-specific Grad-CAM explainability for frontal chest radiographs.
    Strict clinical requirement: Only valid model-specific explainability is produced.
    Decorative or heuristic heatmaps are strictly prohibited.
    """
    try:
        service = ImagingExplainabilityService()
        result = service.generate_explainability(
            asset_id=request.asset_id,
            target_pathology=request.target_pathology,
            case_id=request.case_id,
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.exception("Error generating model-specific explainability")
        raise HTTPException(status_code=500, detail=f"Explainability generation failure: {str(e)}")


@router.get("/asset/{asset_id}", response_model=ImagingExplainabilityResult)
async def get_asset_explainability(
    asset_id: str,
    target_pathology: str = Query("Pneumonia", description="Target pathology to compute gradients for"),
    case_id: Optional[str] = Query(None, description="Associated clinical case ID"),
):
    """
    Retrieve authentic model-specific explainability for a medical image asset.
    """
    try:
        service = ImagingExplainabilityService()
        result = service.generate_explainability(
            asset_id=asset_id,
            target_pathology=target_pathology,
            case_id=case_id,
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.exception("Error retrieving imaging explainability")
        raise HTTPException(status_code=500, detail=f"Explainability failure: {str(e)}")
