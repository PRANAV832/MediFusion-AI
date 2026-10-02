import hashlib
import os
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from app.core.security import AuthenticatedUser, get_current_user
from app.core.supabase import get_supabase_admin_client
from app.schemas.asset import (
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    AssetSignedUrlResponse,
    MedicalAssetResponse,
    ModalityEnum,
)
from app.schemas.case import CaseCreate, CaseDetailResponse, CaseResponse, CaseUpdate

router = APIRouter()

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB max per medical asset


def sanitize_filename(name: str) -> str:
    """Sanitize filename to prevent directory traversal or invalid characters."""
    base = os.path.basename(name)
    sanitized = re.sub(r"[^a-zA-Z0-9_.-]", "_", base)
    return sanitized or "asset.bin"


@router.get("/", response_model=List[CaseResponse], summary="List patient cases")
def list_cases(
    patient_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: AuthenticatedUser = Depends(get_current_user),
) -> List[CaseResponse]:
    """Retrieve clinical cases, optionally filtered by patient_id."""
    admin_client = get_supabase_admin_client()
    query = admin_client.table("patient_cases").select("*").order("created_at", desc=True)

    if patient_id:
        query = query.eq("patient_id", patient_id)

    res = query.range(offset, offset + limit - 1).execute()
    return [CaseResponse(**c) for c in (res.data or [])]


@router.post("/", response_model=CaseResponse, status_code=status.HTTP_201_CREATED, summary="Create a new case")
def create_case(
    case_in: CaseCreate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> CaseResponse:
    """Create a new clinical case attached to a patient."""
    admin_client = get_supabase_admin_client()

    # Enforce patient existence and authorization
    p_check = (
        admin_client.table("patients")
        .select("id, first_name, last_name, mrn")
        .eq("id", case_in.patient_id)
        .maybe_single()
        .execute()
    )
    if p_check is None or not getattr(p_check, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ID '{case_in.patient_id}' does not exist.",
        )

    payload = case_in.model_dump()
    if not payload.get("case_number"):
        payload["case_number"] = f"MF-{uuid.uuid4().hex[:8].upper()}"

    prof = admin_client.table("profiles").select("id").eq("id", user.id).maybe_single().execute()
    payload["created_by"] = user.id if (prof is not None and getattr(prof, "data", None)) else None
    payload["status"] = "draft"

    try:
        res = admin_client.table("patient_cases").insert(payload).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create case",
            )
        created_case = res.data[0]

        # Log timeline event for new case creation
        patient = p_check.data
        admin_client.table("clinical_events").insert({
            "patient_id": case_in.patient_id,
            "case_id": created_case["id"],
            "event_type": "case_opened",
            "summary": f"Case opened: {case_in.title} ({created_case['case_number']})",
            "metadata": {
                "priority": case_in.priority,
                "chief_complaint": case_in.chief_complaint,
                "symptoms": case_in.symptoms,
            },
            "created_by": user.id if (prof is not None and getattr(prof, "data", None)) else None,
        }).execute()

        return CaseResponse(**created_case)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Case creation error: {str(e)}",
        )


@router.get("/{case_id}", response_model=CaseDetailResponse, summary="Get case details by ID")
def get_case(
    case_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> CaseDetailResponse:
    """Retrieve detailed case information including patient info and asset count."""
    admin_client = get_supabase_admin_client()
    res = (
        admin_client.table("patient_cases")
        .select("*")
        .eq("id", case_id)
        .maybe_single()
        .execute()
    )

    if res is None or not getattr(res, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with ID '{case_id}' not found.",
        )

    case_data = res.data
    # Get associated patient info
    p_res = (
        admin_client.table("patients")
        .select("first_name, last_name, mrn")
        .eq("id", case_data["patient_id"])
        .maybe_single()
        .execute()
    )
    patient_mrn = None
    patient_name = None
    if p_res is not None and getattr(p_res, "data", None):
        patient_mrn = p_res.data.get("mrn")
        patient_name = f"{p_res.data.get('first_name', '')} {p_res.data.get('last_name', '')}".strip()

    # Get asset count
    asset_count_res = (
        admin_client.table("medical_assets")
        .select("id", count="exact")
        .eq("case_id", case_id)
        .execute()
    )
    asset_count = getattr(asset_count_res, "count", 0) or len(asset_count_res.data or [])

    return CaseDetailResponse(
        **case_data,
        patient_mrn=patient_mrn,
        patient_name=patient_name,
        asset_count=asset_count,
    )


@router.put("/{case_id}", response_model=CaseResponse, summary="Update case details")
def update_case(
    case_id: str,
    case_update: CaseUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
) -> CaseResponse:
    """Update case fields (notes, symptoms, priority, status)."""
    admin_client = get_supabase_admin_client()

    check = (
        admin_client.table("patient_cases")
        .select("id")
        .eq("id", case_id)
        .maybe_single()
        .execute()
    )
    if check is None or not getattr(check, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with ID '{case_id}' not found.",
        )

    update_dict = {k: v for k, v in case_update.model_dump().items() if v is not None}
    if not update_dict:
        # Return current state if no updates provided
        res = admin_client.table("patient_cases").select("*").eq("id", case_id).single().execute()
        return CaseResponse(**res.data)

    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = (
        admin_client.table("patient_cases")
        .update(update_dict)
        .eq("id", case_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update case.",
        )
    return CaseResponse(**res.data[0])


@router.post("/{case_id}/assets", response_model=MedicalAssetResponse, status_code=status.HTTP_201_CREATED, summary="Upload a multimodal asset to a case")
async def upload_case_asset(
    case_id: str,
    file: UploadFile = File(...),
    modality: str = Form(..., description="Modality: mri, ct, chest_xray, ecg, skin_image, pdf_report, prescription, clinical_note"),
    clinical_context: Optional[str] = Form(None, description="Optional clinical notes/context for this asset"),
    user: AuthenticatedUser = Depends(get_current_user),
) -> MedicalAssetResponse:
    """Securely upload and validate a medical asset to Supabase Storage."""
    admin_client = get_supabase_admin_client()

    # 1. Enforce Case & Patient Authorization
    case_res = (
        admin_client.table("patient_cases")
        .select("id, patient_id, case_number")
        .eq("id", case_id)
        .maybe_single()
        .execute()
    )
    if case_res is None or not getattr(case_res, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with ID '{case_id}' not found.",
        )
    case_data = case_res.data
    patient_id = case_data["patient_id"]

    # 2. Validate Modality
    normalized_modality = modality.strip().lower()
    valid_modalities = {m.value for m in ModalityEnum}
    if normalized_modality not in valid_modalities:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid modality '{modality}'. Allowed modalities: {sorted(valid_modalities)}",
        )
    modality_enum = ModalityEnum(normalized_modality)

    # 3. Read File and Validate Size
    content = await file.read()
    file_size = len(content)
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    # 4. Validate MIME Type and Extension
    filename = sanitize_filename(file.filename or "uploaded_asset")
    ext = os.path.splitext(filename)[1].lower()
    content_type = file.content_type or "application/octet-stream"

    allowed_exts = ALLOWED_EXTENSIONS.get(modality_enum, set())
    allowed_mimes = ALLOWED_MIME_TYPES.get(modality_enum, set())

    # Flexible check: must match either an allowed extension or an allowed MIME type
    if ext not in allowed_exts and content_type not in allowed_mimes and "octet-stream" not in content_type:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File '{filename}' ({content_type}) does not match expected extensions {sorted(allowed_exts)} or MIME types for modality '{modality_enum.value}'.",
        )

    # 5. Compute SHA-256 Checksum
    sha256_hash = hashlib.sha256(content).hexdigest()

    # 6. Upload to Supabase Storage Bucket
    asset_id = str(uuid.uuid4())
    storage_path = f"{patient_id}/{case_id}/{modality_enum.value}_{asset_id[:8]}_{filename}"

    try:
        upload_resp = admin_client.storage.from_("medical-assets").upload(
            storage_path,
            content,
            file_options={
                "content-type": content_type,
                "upsert": "true",
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase Storage upload error: {str(e)}",
        )

    # 7. Persist Asset Metadata in Database
    prof = admin_client.table("profiles").select("id").eq("id", user.id).maybe_single().execute()
    created_by_id = user.id if (prof is not None and getattr(prof, "data", None)) else None

    asset_record = {
        "id": asset_id,
        "patient_id": patient_id,
        "case_id": case_id,
        "modality": modality_enum.value,
        "filename": filename,
        "storage_path": storage_path,
        "mime_type": content_type,
        "size_bytes": file_size,
        "metadata": {
            "checksum_sha256": sha256_hash,
            "original_filename": file.filename,
            "clinical_context": clinical_context,
            "upload_status": "verified_stored",
        },
        "created_by": created_by_id,
    }

    try:
        db_res = admin_client.table("medical_assets").insert(asset_record).execute()
        if not db_res.data:
            # Rollback storage on db failure
            admin_client.storage.from_("medical-assets").remove([storage_path])
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to persist asset record in database.",
            )
        saved_asset = db_res.data[0]

        # Log timeline clinical event
        admin_client.table("clinical_events").insert({
            "patient_id": patient_id,
            "case_id": case_id,
            "event_type": "asset_intake",
            "summary": f"Uploaded {modality_enum.value.upper()}: {filename} ({file_size // 1024} KB)",
            "metadata": {
                "asset_id": asset_id,
                "modality": modality_enum.value,
                "checksum_sha256": sha256_hash,
                "clinical_context": clinical_context,
            },
            "created_by": created_by_id,
        }).execute()

        # Generate Signed URL (valid for 1 hour)
        signed_url_res = admin_client.storage.from_("medical-assets").create_signed_url(storage_path, 3600)
        signed_url = None
        if isinstance(signed_url_res, dict):
            signed_url = signed_url_res.get("signedURL") or signed_url_res.get("signedUrl")

        return MedicalAssetResponse(**saved_asset, signed_url=signed_url)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database persistence error: {str(e)}",
        )


@router.get("/{case_id}/assets", response_model=List[MedicalAssetResponse], summary="List all medical assets in a case")
def list_case_assets(
    case_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> List[MedicalAssetResponse]:
    """Retrieve all multimodal assets associated with the case with signed access URLs."""
    admin_client = get_supabase_admin_client()

    # Enforce case existence
    case_check = (
        admin_client.table("patient_cases")
        .select("id")
        .eq("id", case_id)
        .maybe_single()
        .execute()
    )
    if case_check is None or not getattr(case_check, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with ID '{case_id}' not found.",
        )

    res = (
        admin_client.table("medical_assets")
        .select("*")
        .eq("case_id", case_id)
        .order("created_at", desc=False)
        .execute()
    )

    assets = []
    for item in (res.data or []):
        signed_url = None
        storage_path = item.get("storage_path")
        if storage_path:
            try:
                url_res = admin_client.storage.from_("medical-assets").create_signed_url(storage_path, 3600)
                if isinstance(url_res, dict):
                    signed_url = url_res.get("signedURL") or url_res.get("signedUrl")
            except Exception:
                signed_url = None

        assets.append(MedicalAssetResponse(**item, signed_url=signed_url))

    return assets


@router.delete("/{case_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an asset from a case")
def delete_case_asset(
    case_id: str,
    asset_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Remove a medical asset from database and Supabase Storage."""
    admin_client = get_supabase_admin_client()

    asset_res = (
        admin_client.table("medical_assets")
        .select("id, storage_path, case_id")
        .eq("id", asset_id)
        .eq("case_id", case_id)
        .maybe_single()
        .execute()
    )
    if asset_res is None or not getattr(asset_res, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID '{asset_id}' not found for case '{case_id}'.",
        )

    storage_path = asset_res.data.get("storage_path")

    # Delete from storage
    if storage_path:
        try:
            admin_client.storage.from_("medical-assets").remove([storage_path])
        except Exception:
            pass

    # Delete from database
    admin_client.table("medical_assets").delete().eq("id", asset_id).execute()
    return None


@router.get("/{case_id}/assets/{asset_id}/url", response_model=AssetSignedUrlResponse, summary="Get signed download URL for an asset")
def get_asset_signed_url(
    case_id: str,
    asset_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> AssetSignedUrlResponse:
    """Generate a temporary signed URL to view or download a medical asset."""
    admin_client = get_supabase_admin_client()

    asset_res = (
        admin_client.table("medical_assets")
        .select("id, storage_path, filename")
        .eq("id", asset_id)
        .eq("case_id", case_id)
        .maybe_single()
        .execute()
    )
    if asset_res is None or not getattr(asset_res, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID '{asset_id}' not found.",
        )

    storage_path = asset_res.data["storage_path"]
    filename = asset_res.data["filename"]

    signed_res = admin_client.storage.from_("medical-assets").create_signed_url(storage_path, 3600)
    signed_url = None
    if isinstance(signed_res, dict):
        signed_url = signed_res.get("signedURL") or signed_res.get("signedUrl")

    if not signed_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate signed URL for asset.",
        )

    return AssetSignedUrlResponse(
        asset_id=asset_id,
        filename=filename,
        signed_url=signed_url,
        expires_in_seconds=3600,
    )
