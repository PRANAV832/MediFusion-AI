import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.schemas.council import ModelCouncilResult
from app.services.model_council import ModelCouncilService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/council", tags=["Model Council"])


class DeliberateRequest(BaseModel):
    case_id: str
    asset_id: str
    force_council: bool = False


@router.post("/deliberate", response_model=ModelCouncilResult)
async def deliberate_case(request: DeliberateRequest):
    """
    Run multi-model council deliberation for ambiguous clinical cases.
    Evaluates compatible specialized models, reports agreements/disagreements,
    and lists missing models without fabricating fake results.
    """
    try:
        service = ModelCouncilService()
        result = service.assess_case(
            case_id=request.case_id,
            asset_id=request.asset_id,
            force_council=request.force_council,
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.exception("Model Council deliberation error")
        raise HTTPException(status_code=500, detail=f"Deliberation failure: {str(e)}")


@router.get("/case/{case_id}", response_model=ModelCouncilResult)
async def get_case_council(
    case_id: str,
    asset_id: str = Query(..., description="Target asset ID for council deliberation"),
    force: bool = Query(False, description="Force council deliberation even if non-ambiguous"),
):
    """
    Retrieve or compute model council deliberation for a specific case asset.
    """
    try:
        service = ModelCouncilService()
        result = service.assess_case(
            case_id=case_id,
            asset_id=asset_id,
            force_council=force,
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.exception("Error evaluating case council")
        raise HTTPException(status_code=500, detail=f"Deliberation failure: {str(e)}")
