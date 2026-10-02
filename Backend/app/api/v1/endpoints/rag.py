import logging
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from app.core.security import AuthenticatedUser, get_current_user
from app.rag.service import PatientRAGService, get_rag_service
from app.schemas.rag import (
    EvidenceSearchRequest,
    EvidenceSearchResponse,
    IngestResponse,
    IngestTextRequest,
    PatientKnowledgeResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/ingest/text", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest_clinical_text(
    payload: IngestTextRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    rag_service: PatientRAGService = Depends(get_rag_service),
):
    """Ingest raw clinical text/notes into the patient knowledge store with pgvector embeddings."""
    return rag_service.ingest_text(
        patient_id=payload.patient_id,
        content=payload.content,
        filename=payload.filename,
        document_type=payload.document_type,
        case_id=payload.case_id,
        document_id=payload.document_id,
        event_date=payload.event_date,
        domain=payload.domain,
        source_path=payload.source_path,
        extra_metadata=payload.metadata,
    )


@router.post("/ingest/file", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest_clinical_file(
    file: UploadFile = File(..., description="Document file (PDF, TXT, MD)"),
    patient_id: str = Form(..., description="Target patient UUID (mandatory server-side isolation)"),
    case_id: Optional[str] = Form(None, description="Optional associated case UUID"),
    document_type: str = Form("clinical_note", description="Document type"),
    event_date: Optional[str] = Form(None, description="Clinical event date (YYYY-MM-DD)"),
    domain: str = Form("clinical", description="Clinical specialty domain"),
    source_path: Optional[str] = Form(None, description="Optional source reference"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    rag_service: PatientRAGService = Depends(get_rag_service),
):
    """Ingest uploaded document (e.g. PDF lab/radiology report) with full page extraction and pgvector storage."""
    try:
        content_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {str(e)}",
        )

    return rag_service.ingest_document(
        patient_id=patient_id,
        content_bytes=content_bytes,
        filename=file.filename or "document.pdf",
        document_type=document_type,
        case_id=case_id,
        event_date=event_date,
        domain=domain,
        source_path=source_path,
    )


@router.post("/search", response_model=EvidenceSearchResponse)
async def search_patient_evidence(
    payload: EvidenceSearchRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    rag_service: PatientRAGService = Depends(get_rag_service),
):
    """Semantic vector search scoped strictly to the requested patient.

    Patient isolation is enforced at the database level.
    """
    evidence = rag_service.search_patient_evidence(
        patient_id=payload.patient_id,
        query=payload.query,
        case_id=payload.case_id,
        domain=payload.domain,
        document_type=payload.document_type,
        top_k=payload.top_k,
        match_threshold=payload.match_threshold,
        temporal_scope=payload.temporal_scope,
        current_threshold_days=payload.current_threshold_days,
        reference_date=payload.reference_date,
    )

    return EvidenceSearchResponse(
        patient_id=payload.patient_id,
        query=payload.query,
        total_retrieved=len(evidence),
        evidence=evidence,
    )


@router.get("/patient/{patient_id}/knowledge", response_model=PatientKnowledgeResponse)
async def get_patient_knowledge(
    patient_id: str,
    case_id: Optional[str] = Query(None, description="Optional case UUID filter"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
    rag_service: PatientRAGService = Depends(get_rag_service),
):
    """Retrieve all indexed clinical knowledge chunks for a patient."""
    chunks = rag_service.list_patient_knowledge(
        patient_id=patient_id,
        case_id=case_id,
        limit=limit,
        offset=offset,
    )
    return PatientKnowledgeResponse(
        patient_id=patient_id,
        total_chunks=len(chunks),
        chunks=chunks,
    )


@router.delete("/chunks/{chunk_id}")
async def delete_knowledge_chunk(
    chunk_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    rag_service: PatientRAGService = Depends(get_rag_service),
):
    """Delete a specific knowledge chunk."""
    rag_service.delete_chunk(chunk_id)
    return {"message": f"Knowledge chunk {chunk_id} successfully deleted"}
