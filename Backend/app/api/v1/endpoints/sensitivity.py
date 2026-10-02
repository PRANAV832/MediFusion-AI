import logging
from fastapi import APIRouter, HTTPException

from app.schemas.sensitivity import EvidenceSensitivityAssessment
from app.services.sensitivity import EvidenceSensitivityService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sensitivity", tags=["Evidence Sensitivity"])


@router.get("/case/{case_id}", response_model=EvidenceSensitivityAssessment)
async def get_case_sensitivity(case_id: str):
    """
    Retrieve evidence sensitivity analysis for the generated synthesis of a case.
    Shows which canonical evidence items contributed to the clinical synthesis narrative,
    with normalized grounding weights and a mandatory non-causal disclaimer.
    """
    try:
        service = EvidenceSensitivityService()
        assessment = service.analyze_case_sensitivity(case_id=case_id)
        return assessment
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.exception("Error computing evidence sensitivity")
        raise HTTPException(status_code=500, detail=f"Sensitivity analysis failure: {str(e)}")
