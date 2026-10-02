"""
MediFusion AI — Phase 11 Canonical Evidence API Endpoints
Exposes case evidence graph, finding details, provenance trace,
and critical anti-self-referencing validation.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.security import AuthenticatedUser, get_current_user
from app.schemas.evidence import (
    CanonicalCaseEvidenceGraph,
    EvidenceItem,
    EvidenceLink,
    Finding,
    validate_canonical_support,
)
from app.services.evidence import EvidenceService

router = APIRouter()


class CreateSynthesisEvidenceRequest(BaseModel):
    title: str = Field(..., description="Synthesis title")
    summary: str = Field(..., description="Clinical synthesis summary")
    content: Optional[str] = Field(None, description="Detailed synthesis content")
    supporting_evidence_ids: List[str] = Field(
        ..., min_length=1, description="List of actual supporting evidence IDs"
    )


class ValidationResultResponse(BaseModel):
    valid: bool
    message: str
    violates_critical_rule: bool = False


@router.get("/case/{case_id}", response_model=CanonicalCaseEvidenceGraph)
async def get_case_evidence_graph(
    case_id: str,
    patient_id: Optional[str] = Query(None, description="Optional patient UUID override"),
    current_user: Any = Depends(get_current_user),
) -> CanonicalCaseEvidenceGraph:
    """
    Retrieve or assemble the canonical evidence graph for a case.
    Aggregates MODEL_FINDING, PATIENT_RECORD, TRUSTED_KNOWLEDGE, and GENERATED_SYNTHESIS items
    with complete bidirectional links and provenance records.
    """
    service = EvidenceService()
    try:
        graph = service.assemble_case_evidence(case_id=case_id, patient_id=patient_id)
        return graph
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assemble case evidence graph: {str(e)}",
        )


@router.get("/item/{evidence_id}", response_model=EvidenceItem)
async def get_evidence_item(
    evidence_id: str,
    current_user: Any = Depends(get_current_user),
) -> EvidenceItem:
    """
    Retrieve an individual canonical evidence item with complete provenance.
    """
    service = EvidenceService()
    resp = (
        service.db.table("canonical_evidence_items")
        .select("*")
        .eq("id", evidence_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence item '{evidence_id}' not found.",
        )
    return EvidenceItem(**resp.data)


@router.get("/finding/{finding_id}", response_model=Finding)
async def get_finding(
    finding_id: str,
    current_user: Any = Depends(get_current_user),
) -> Finding:
    """
    Retrieve clinical finding details including linked primary and supporting evidence IDs.
    """
    service = EvidenceService()
    resp = (
        service.db.table("canonical_findings")
        .select("*")
        .eq("id", finding_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Finding '{finding_id}' not found.",
        )
    return Finding(**resp.data)


@router.post("/case/{case_id}/synthesis", response_model=EvidenceItem)
async def create_synthesis_evidence(
    case_id: str,
    payload: CreateSynthesisEvidenceRequest,
    patient_id: Optional[str] = Query(None),
    current_user: Any = Depends(get_current_user),
) -> EvidenceItem:
    """
    Create a new GENERATED_SYNTHESIS evidence item for a case.
    Strictly enforces CRITICAL RULE:
    GENERATED_SYNTHESIS cannot support itself. It must point to actual evidence.
    """
    service = EvidenceService()
    try:
        # Resolve patient_id if not in query
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

        item = service.create_custom_synthesis_evidence(
            case_id=case_id,
            patient_id=patient_id,
            title=payload.title,
            summary=payload.summary,
            supporting_evidence_ids=payload.supporting_evidence_ids,
            content=payload.content,
        )
        return item
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve),
        )
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create synthesis evidence: {str(ex)}",
        )
