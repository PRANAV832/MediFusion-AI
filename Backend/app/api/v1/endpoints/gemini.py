import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.security import AuthenticatedUser, get_current_user
from app.core.supabase import get_supabase_admin_client
from app.rag.service import PatientRAGService, get_rag_service
from app.schemas.gemini import (
    GeminiStatusResponse,
    GeminiSynthesisRequest,
    GeminiSynthesisResult,
    ModelFindingItem,
    PatientContextBundle,
    RetrievedEvidenceBundleItem,
    StructuredEvidenceBundle,
)
from app.services.gemini import GeminiService, get_gemini_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status", response_model=GeminiStatusResponse)
async def check_gemini_status(
    gemini_service: GeminiService = Depends(get_gemini_service),
):
    """Check readiness of Google Gemini API key and evidence-language layer."""
    return gemini_service.get_status()


@router.post("/synthesize", response_model=GeminiSynthesisResult)
async def execute_gemini_synthesis(
    payload: GeminiSynthesisRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    gemini_service: GeminiService = Depends(get_gemini_service),
):
    """Execute evidence-language synthesis strictly grounded in the supplied structured evidence bundle."""
    return gemini_service.execute_synthesis(payload)


@router.post("/case/{case_id}/synthesize", response_model=GeminiSynthesisResult)
async def synthesize_case_evidence(
    case_id: str,
    action: str = Query(
        "evidence_grounded_synthesis",
        description="Action: evidence_grounded_synthesis | screening_report_draft | clinical_history_summary | bounded_evidence_comparison"
    ),
    current_user: AuthenticatedUser = Depends(get_current_user),
    gemini_service: GeminiService = Depends(get_gemini_service),
    rag_service: PatientRAGService = Depends(get_rag_service),
):
    """Automated Case Evidence Synthesis:

    Pulls case details, specialized model run findings, and retrieved patient evidence,
    constructs the structured evidence bundle, and invokes Gemini for grounded synthesis.
    """
    admin_client = get_supabase_admin_client()

    # 1. Fetch Case Record
    case_res = admin_client.table("patient_cases").select("*").eq("id", case_id).maybe_single().execute()
    case_data = case_res.data
    if not case_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found",
        )

    patient_id = case_data.get("patient_id")

    # 2. Fetch Patient Profile
    patient_res = admin_client.table("patients").select("*").eq("id", patient_id).maybe_single().execute()
    patient_data = patient_res.data or {}

    # 3. Fetch Model Runs for this Case
    runs_res = admin_client.table("model_runs").select("*").eq("case_id", case_id).execute()
    model_runs = runs_res.data or []

    model_findings_items = []
    provenance_ids = []

    for run in model_runs:
        run_id = str(run.get("id"))
        provenance_ids.append(run_id)
        findings = run.get("findings") or []
        for f in findings:
            model_findings_items.append(
                ModelFindingItem(
                    finding_id=f.get("finding_id") or run_id,
                    model_id=run.get("model_id", "unknown"),
                    capability=run.get("capability", "screening"),
                    finding=f.get("finding") or f.get("label", "Observation"),
                    confidence=float(f.get("confidence") or f.get("score") or 0.0),
                    severity=f.get("severity"),
                    run_id=run_id,
                    provenance_id=run_id,
                )
            )

    # 4. Retrieve Patient Evidence via RAG (Patient-Scoped)
    query_text = f"{case_data.get('chief_complaint', '')} {case_data.get('symptoms', '')}".strip() or "clinical history"
    retrieved_chunks = rag_service.search_patient_evidence(
        patient_id=patient_id,
        query=query_text,
        case_id=None,
        top_k=5,
    )

    retrieved_bundle_items = []
    for c in retrieved_chunks:
        provenance_ids.append(c.id)
        retrieved_bundle_items.append(
            RetrievedEvidenceBundleItem(
                id=c.id,
                content=c.clean_content or c.content,
                filename=c.filename,
                page_number=c.page_number,
                event_date=c.event_date,
                document_type=c.document_type,
                domain=c.domain,
                similarity=c.similarity,
            )
        )

    # 5. Assemble Structured Evidence Bundle
    bundle = StructuredEvidenceBundle(
        patient_context=PatientContextBundle(
            patient_id=patient_id,
            name=f"{patient_data.get('first_name', '')} {patient_data.get('last_name', '')}".strip() or "Patient",
            chronic_conditions=patient_data.get("chronic_conditions") or [],
            allergies=patient_data.get("allergies") or [],
            chief_complaint=case_data.get("chief_complaint"),
            symptoms=case_data.get("symptoms"),
        ),
        model_findings=model_findings_items,
        retrieved_evidence=retrieved_bundle_items,
        provenance_ids=provenance_ids,
        uncertainty={"model_run_count": len(model_runs), "rag_evidence_count": len(retrieved_chunks)},
        conflict_flags=[],
    )

    request_payload = GeminiSynthesisRequest(
        action=action,
        evidence_bundle=bundle,
    )

    return gemini_service.execute_synthesis(request_payload)
