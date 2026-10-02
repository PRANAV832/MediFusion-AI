"""
MediFusion AI — Phase 15 Clinician-Facing Screening Report Endpoints.
Provides 14-section Clinical Intelligence Summary compilation, clinician sign-off,
uncertainty audits, and printable markdown export.
"""

import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.core.security import AuthenticatedUser, get_current_user
from app.schemas.report import (
    ClinicalIntelligenceSummary,
    ScreeningReportSignOffRequest,
)
from app.services.screening_report import ScreeningReportService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/cases/{case_id}/screening-report", response_model=ClinicalIntelligenceSummary)
async def get_case_screening_report(
    case_id: str,
    force_regenerate: bool = Query(False, description="Force reassembly from live case assets and models"),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ClinicalIntelligenceSummary:
    """
    Retrieve or assemble the 14-section clinician-facing Screening Report / Clinical Intelligence Summary.
    Enforces strict non-definitive screening taxonomy (never 'Final Diagnosis').
    Explicitly articulates all uncertainty metrics and authentic evidence labels.
    """
    service = ScreeningReportService()
    try:
        summary = service.assemble_case_screening_report(
            case_id=case_id,
            force_regenerate=force_regenerate,
        )
        return summary
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as ex:
        logger.error(f"Error compiling screening report for case {case_id}: {ex}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile screening report: {str(ex)}",
        )


@router.post("/cases/{case_id}/screening-report/generate", response_model=ClinicalIntelligenceSummary)
async def force_generate_case_screening_report(
    case_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ClinicalIntelligenceSummary:
    """
    Force recompilation of the 14-section Screening Report reflecting latest model runs or asset updates.
    """
    service = ScreeningReportService()
    try:
        summary = service.assemble_case_screening_report(
            case_id=case_id,
            force_regenerate=True,
        )
        return summary
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as ex:
        logger.error(f"Error regenerating screening report for case {case_id}: {ex}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate screening report: {str(ex)}",
        )


@router.post("/cases/{case_id}/screening-report/sign-off", response_model=ClinicalIntelligenceSummary)
async def sign_off_screening_report(
    case_id: str,
    sign_off_data: ScreeningReportSignOffRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ClinicalIntelligenceSummary:
    """
    Records clinician review notes, digital signature, and disposition sign-off.
    """
    service = ScreeningReportService()
    try:
        clinician_name = getattr(current_user, "email", "Attending Physician")
        if not sign_off_data.clinician_name:
            sign_off_data.clinician_name = clinician_name

        summary = service.sign_off_screening_report(
            case_id=case_id,
            sign_off_data=sign_off_data,
            clinician_id=getattr(current_user, "id", None),
        )
        return summary
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as ex:
        logger.error(f"Error signing off report for case {case_id}: {ex}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record clinician sign-off: {str(ex)}",
        )


@router.get("/cases/{case_id}/screening-report/export")
async def export_screening_report_markdown(
    case_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Response:
    """
    Generates and returns formatted clinical Markdown dossier for print/export.
    """
    service = ScreeningReportService()
    try:
        summary = service.assemble_case_screening_report(case_id=case_id)
        md_text = service.export_screening_report_markdown(summary)
        return Response(
            content=md_text,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f"attachment; filename=screening_report_{case_id[:8]}.md"
            },
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export screening report markdown: {str(ex)}",
        )
