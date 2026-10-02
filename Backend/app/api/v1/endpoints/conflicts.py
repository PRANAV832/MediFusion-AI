"""
MediFusion AI — Phase 12 Conflict Detection Endpoints
Exposes case review assessment, pairwise conflict comparisons,
and synthetic conflict test fixtures.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.security import AuthenticatedUser, get_current_user
from app.schemas.conflicts import (
    CaseReviewAssessment,
    StructuredConflictItem,
)
from app.services.conflict_detector import ConflictDetectorService

router = APIRouter()


class ResolveConflictRequest(BaseModel):
    status: str = Field("RESOLVED", description="ACKNOWLEDGED or RESOLVED")
    resolution_notes: str = Field(..., description="Clinician reasoning for resolution")


class SyntheticFixtureRequest(BaseModel):
    fixture_type: str = Field(
        "model_vs_history",
        description="model_disagreement, model_vs_history, missing_evidence, poor_image_quality",
    )


@router.get("/case/{case_id}", response_model=CaseReviewAssessment)
async def get_case_review_assessment(
    case_id: str,
    patient_id: Optional[str] = Query(None),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> CaseReviewAssessment:
    """
    Evaluate or retrieve structured conflict detection and clinician review state for a case.
    Reports 5 separate dimensions (model confidence, cross-model agreement, historical support,
    evidence completeness, input quality) and pairwise Evidence A vs Evidence B conflicts.
    """
    service = ConflictDetectorService()
    try:
        assessment = service.evaluate_case(case_id=case_id, patient_id=patient_id)
        return assessment
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate case conflicts: {str(ex)}",
        )


@router.post("/case/{case_id}/evaluate", response_model=CaseReviewAssessment)
async def reevaluate_case_conflicts(
    case_id: str,
    patient_id: Optional[str] = Query(None),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> CaseReviewAssessment:
    """
    Force re-evaluation of conflict detection and update the case review assessment.
    """
    service = ConflictDetectorService()
    try:
        assessment = service.evaluate_case(case_id=case_id, patient_id=patient_id)
        return assessment
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to re-evaluate case conflicts: {str(ex)}",
        )


@router.post("/case/{case_id}/fixture", response_model=CaseReviewAssessment)
async def create_synthetic_conflict_fixture(
    case_id: str,
    payload: SyntheticFixtureRequest,
    patient_id: Optional[str] = Query(None),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> CaseReviewAssessment:
    """
    Generate a deterministic synthetic conflict fixture for testing and clinician review demonstration.
    Supported types: model_disagreement, model_vs_history, missing_evidence, poor_image_quality.
    """
    service = ConflictDetectorService()
    try:
        # Resolve patient_id if missing
        if not patient_id:
            c = (
                service.db.table("patient_cases")
                .select("patient_id")
                .eq("id", case_id)
                .single()
                .execute()
            )
            if not c.data:
                raise HTTPException(status_code=404, detail="Case not found.")
            patient_id = c.data["patient_id"]

        assessment = service.create_synthetic_conflict_fixture(
            case_id=case_id,
            patient_id=patient_id,
            fixture_type=payload.fixture_type,
        )
        return assessment
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate synthetic conflict fixture: {str(ex)}",
        )


@router.post("/{conflict_id}/resolve", response_model=Dict[str, Any])
async def resolve_conflict(
    conflict_id: str,
    payload: ResolveConflictRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Record clinician resolution or acknowledgement of a conflict item.
    """
    service = ConflictDetectorService()
    res = (
        service.db.table("case_conflicts")
        .update({
            "status": payload.status,
            "resolution_notes": payload.resolution_notes,
        })
        .eq("id", conflict_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conflict item '{conflict_id}' not found.",
        )
    return {"message": "Conflict resolved successfully", "conflict": res.data[0]}
