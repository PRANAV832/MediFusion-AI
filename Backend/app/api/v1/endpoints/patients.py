import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.security import AuthenticatedUser, get_current_user
from app.core.supabase import get_supabase_admin_client
from app.schemas.case import CaseCreate, CaseResponse
from app.schemas.document import DocumentCreate, DocumentResponse
from app.schemas.patient import (
    PatientCreate,
    PatientResponse,
    PatientSummaryResponse,
    PatientUpdate,
)
from app.schemas.report import ScreeningReportCreate, ScreeningReportResponse
from app.schemas.timeline import ClinicalEventCreate, ClinicalEventResponse

router = APIRouter()


def _verify_patient_exists(admin_client, patient_id: str):
    res = admin_client.table("patients").select("id").eq("id", patient_id).maybe_single().execute()
    if res is None or not getattr(res, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID '{patient_id}' not found.",
        )


@router.get("/", response_model=List[PatientResponse], summary="List patients with filtering")
def list_patients(
    search: Optional[str] = Query(None, description="Search by name or MRN"),
    gender: Optional[str] = Query(None, description="Filter by gender"),
    blood_type: Optional[str] = Query(None, description="Filter by blood type"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: AuthenticatedUser = Depends(get_current_user),
) -> List[PatientResponse]:
    """Retrieve list of patients for authenticated clinician with optional filtering."""
    admin_client = get_supabase_admin_client()
    query = admin_client.table("patients").select("*").order("created_at", desc=True)

    if gender:
        query = query.ilike("gender", f"%{gender}%")
    if blood_type:
        query = query.eq("blood_type", blood_type)
    if search:
        # Search MRN, first_name or last_name
        query = query.or_(f"mrn.ilike.%{search}%,first_name.ilike.%{search}%,last_name.ilike.%{search}%")

    res = query.range(offset, offset + limit - 1).execute()
    return [PatientResponse(**p) for p in res.data]


@router.post("/", response_model=PatientResponse, status_code=status.HTTP_201_CREATED, summary="Create a new patient")
def create_patient(
    patient_in: PatientCreate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> PatientResponse:
    """Register a new patient record in Supabase."""
    admin_client = get_supabase_admin_client()

    payload = patient_in.model_dump()
    payload["date_of_birth"] = str(payload["date_of_birth"])

    prof = admin_client.table("profiles").select("id").eq("id", user.id).maybe_single().execute()
    if prof is not None and getattr(prof, "data", None):
        payload["created_by"] = user.id
        payload["assigned_clinician_id"] = user.id
    else:
        payload["created_by"] = None
        payload["assigned_clinician_id"] = None

    try:
        res = admin_client.table("patients").insert(payload).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create patient record",
            )
        return PatientResponse(**res.data[0])
    except Exception as e:
        if "duplicate key value" in str(e) or "unique constraint" in str(e).lower() or "mrn" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Patient with MRN '{patient_in.mrn}' already exists.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Patient creation error: {str(e)}",
        )


@router.get("/{patient_id}", response_model=PatientResponse, summary="Get patient by ID")
def get_patient(
    patient_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> PatientResponse:
    """Retrieve patient record by UUID."""
    admin_client = get_supabase_admin_client()
    res = admin_client.table("patients").select("*").eq("id", patient_id).maybe_single().execute()

    if res is None or not getattr(res, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID '{patient_id}' not found.",
        )

    return PatientResponse(**res.data)


@router.patch("/{patient_id}", response_model=PatientResponse, summary="Update patient details")
def update_patient(
    patient_id: str,
    patient_update: PatientUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> PatientResponse:
    """Update patient demographic and clinical baseline details."""
    admin_client = get_supabase_admin_client()
    _verify_patient_exists(admin_client, patient_id)

    payload = {k: v for k, v in patient_update.model_dump().items() if v is not None}
    if "date_of_birth" in payload and payload["date_of_birth"] is not None:
        payload["date_of_birth"] = str(payload["date_of_birth"])

    if not payload:
        res = admin_client.table("patients").select("*").eq("id", patient_id).single().execute()
        return PatientResponse(**res.data)

    res = admin_client.table("patients").update(payload).eq("id", patient_id).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update patient record.",
        )

    return PatientResponse(**res.data[0])


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete patient")
def delete_patient(
    patient_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Delete patient and cascade delete associated records."""
    admin_client = get_supabase_admin_client()
    _verify_patient_exists(admin_client, patient_id)
    admin_client.table("patients").delete().eq("id", patient_id).execute()
    return None


@router.get("/{patient_id}/summary", response_model=PatientSummaryResponse, summary="Patient 360 overview metrics")
def get_patient_summary(
    patient_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> PatientSummaryResponse:
    """Aggregate Patient 360 overview metrics for the clinical workstation."""
    admin_client = get_supabase_admin_client()
    p_res = admin_client.table("patients").select("*").eq("id", patient_id).maybe_single().execute()

    if p_res is None or not getattr(p_res, "data", None):
        raise HTTPException(status_code=404, detail="Patient not found")

    patient_data = p_res.data

    # Count cases
    cases_res = admin_client.table("patient_cases").select("id", count="exact").eq("patient_id", patient_id).execute()
    total_cases = cases_res.count if cases_res.count is not None else len(cases_res.data)

    # Count events & find latest
    events_res = (
        admin_client.table("clinical_events")
        .select("event_date", count="exact")
        .eq("patient_id", patient_id)
        .order("event_date", desc=True)
        .execute()
    )
    total_events = events_res.count if events_res.count is not None else len(events_res.data)
    last_event_date = events_res.data[0]["event_date"] if events_res.data else None

    # Count documents
    docs_res = admin_client.table("documents").select("id", count="exact").eq("patient_id", patient_id).execute()
    total_docs = docs_res.count if docs_res.count is not None else len(docs_res.data)

    # Count reports
    reports_res = admin_client.table("screening_reports").select("id", count="exact").eq("patient_id", patient_id).execute()
    total_reports = reports_res.count if reports_res.count is not None else len(reports_res.data)

    return PatientSummaryResponse(
        patient=PatientResponse(**patient_data),
        total_cases=total_cases,
        total_events=total_events,
        total_documents=total_docs,
        total_reports=total_reports,
        active_conditions=patient_data.get("chronic_conditions") or [],
        allergies=patient_data.get("allergies") or [],
        last_activity_date=last_event_date,
    )


# --- TIMELINE ENDPOINTS ---

@router.get("/{patient_id}/timeline", response_model=List[ClinicalEventResponse], summary="Get patient longitudinal timeline")
def get_patient_timeline(
    patient_id: str,
    limit: int = Query(100, ge=1, le=200),
    user: AuthenticatedUser = Depends(get_current_user),
) -> List[ClinicalEventResponse]:
    """Retrieve chronological clinical events timeline for patient."""
    admin_client = get_supabase_admin_client()
    _verify_patient_exists(admin_client, patient_id)

    res = (
        admin_client.table("clinical_events")
        .select("*")
        .eq("patient_id", patient_id)
        .order("event_date", desc=True)
        .limit(limit)
        .execute()
    )
    return [ClinicalEventResponse(**e) for e in res.data]


@router.post("/{patient_id}/timeline", response_model=ClinicalEventResponse, status_code=status.HTTP_201_CREATED, summary="Log clinical event to timeline")
def add_timeline_event(
    patient_id: str,
    event_in: ClinicalEventCreate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ClinicalEventResponse:
    """Record an encounter, lab result, imaging event, or prescription to patient timeline."""
    admin_client = get_supabase_admin_client()
    _verify_patient_exists(admin_client, patient_id)

    payload = event_in.model_dump()
    payload["patient_id"] = patient_id
    payload["event_date"] = payload["event_date"].isoformat()

    prof = admin_client.table("profiles").select("id").eq("id", user.id).maybe_single().execute()
    payload["created_by"] = user.id if (prof is not None and getattr(prof, "data", None)) else None

    res = admin_client.table("clinical_events").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to log timeline event")

    return ClinicalEventResponse(**res.data[0])


# --- CASES ENDPOINTS ---

@router.get("/{patient_id}/cases", response_model=List[CaseResponse], summary="Get cases for patient")
def get_patient_cases(
    patient_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> List[CaseResponse]:
    """Retrieve all clinical cases for patient."""
    admin_client = get_supabase_admin_client()
    _verify_patient_exists(admin_client, patient_id)

    res = (
        admin_client.table("patient_cases")
        .select("*")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [CaseResponse(**c) for c in res.data]


@router.post("/{patient_id}/cases", response_model=CaseResponse, status_code=status.HTTP_201_CREATED, summary="Create case for patient")
def create_patient_case(
    patient_id: str,
    case_in: CaseCreate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> CaseResponse:
    """Create a new clinical case attached to the patient."""
    admin_client = get_supabase_admin_client()
    _verify_patient_exists(admin_client, patient_id)

    payload = case_in.model_dump()
    payload["patient_id"] = patient_id
    if not payload.get("case_number"):
        payload["case_number"] = f"CASE-{uuid.uuid4().hex[:8].upper()}"

    prof = admin_client.table("profiles").select("id").eq("id", user.id).maybe_single().execute()
    payload["created_by"] = user.id if (prof is not None and getattr(prof, "data", None)) else None
    payload["status"] = "draft"

    res = admin_client.table("patient_cases").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create case")

    return CaseResponse(**res.data[0])


# --- DOCUMENTS ENDPOINTS ---

@router.get("/{patient_id}/documents", response_model=List[DocumentResponse], summary="Get documents for patient")
def get_patient_documents(
    patient_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> List[DocumentResponse]:
    """Retrieve all historical documents for patient."""
    admin_client = get_supabase_admin_client()
    _verify_patient_exists(admin_client, patient_id)

    res = (
        admin_client.table("documents")
        .select("*")
        .eq("patient_id", patient_id)
        .order("document_date", desc=True)
        .execute()
    )
    return [DocumentResponse(**d) for d in res.data]


@router.post("/{patient_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED, summary="Add document for patient")
def add_patient_document(
    patient_id: str,
    doc_in: DocumentCreate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> DocumentResponse:
    """Add a historical medical document or clinical report to the patient record."""
    admin_client = get_supabase_admin_client()
    _verify_patient_exists(admin_client, patient_id)

    payload = doc_in.model_dump()
    payload["patient_id"] = patient_id
    payload["document_date"] = str(payload["document_date"])

    prof = admin_client.table("profiles").select("id").eq("id", user.id).maybe_single().execute()
    payload["created_by"] = user.id if (prof is not None and getattr(prof, "data", None)) else None

    res = admin_client.table("documents").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create document")

    return DocumentResponse(**res.data[0])


# --- REPORTS ENDPOINTS ---

@router.get("/{patient_id}/reports", response_model=List[ScreeningReportResponse], summary="Get screening reports for patient")
def get_patient_reports(
    patient_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> List[ScreeningReportResponse]:
    """Retrieve all clinical screening reports for patient."""
    admin_client = get_supabase_admin_client()
    _verify_patient_exists(admin_client, patient_id)

    res = (
        admin_client.table("screening_reports")
        .select("*")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [ScreeningReportResponse(**r) for r in res.data]


@router.post("/{patient_id}/reports", response_model=ScreeningReportResponse, status_code=status.HTTP_201_CREATED, summary="Add screening report for patient")
def add_patient_report(
    patient_id: str,
    report_in: ScreeningReportCreate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ScreeningReportResponse:
    """Create a preliminary or draft screening report."""
    admin_client = get_supabase_admin_client()
    _verify_patient_exists(admin_client, patient_id)

    payload = report_in.model_dump()
    payload["patient_id"] = patient_id
    payload["status"] = "draft"

    prof = admin_client.table("profiles").select("id").eq("id", user.id).maybe_single().execute()
    payload["created_by"] = user.id if (prof is not None and getattr(prof, "data", None)) else None

    res = admin_client.table("screening_reports").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create report")

    return ScreeningReportResponse(**res.data[0])
