import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.exceptions import ModelResourceUnavailableException
from app.core.security import AuthenticatedUser, get_current_user
from app.core.supabase import get_supabase_admin_client
from app.models.manager import model_manager
from app.models.registry import adapter_registry
from app.scheduler import resource_scheduler
from app.schemas.model_run import (
    ModelFinding,
    ModelRunRequest,
    ModelRunResponse,
    ModelStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status", response_model=ModelStatusResponse, summary="Get medical model status and health")
def get_model_status(
    model_id: str = Query("torchxrayvision-densenet121", description="Model identifier to check"),
    user: AuthenticatedUser = Depends(get_current_user),
) -> ModelStatusResponse:
    """
    Query the operational status of a specialized clinical model.
    Returns READY, NOT_CONFIGURED, MODEL_UNAVAILABLE, or ERROR.
    """
    return model_manager.get_status(model_id=model_id)


@router.get("/cases/{case_id}/runs", response_model=List[ModelRunResponse], summary="List model runs for a case")
def list_case_model_runs(
    case_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> List[ModelRunResponse]:
    """
    Retrieve all persisted specialized model inference runs for a clinical case.
    """
    admin_client = get_supabase_admin_client()

    # Verify case exists
    case_res = (
        admin_client.table("patient_cases")
        .select("id")
        .eq("id", case_id)
        .maybe_single()
        .execute()
    )
    if case_res is None or not getattr(case_res, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clinical case with ID '{case_id}' was not found.",
        )

    runs_res = (
        admin_client.table("model_runs")
        .select("*")
        .eq("case_id", case_id)
        .order("created_at", desc=True)
        .execute()
    )

    results = []
    for item in (runs_res.data or []):
        findings_raw = item.get("findings") or []
        findings = [ModelFinding(**f) for f in findings_raw] if findings_raw else []
        results.append(
            ModelRunResponse(
                id=item["id"],
                case_id=item["case_id"],
                patient_id=item["patient_id"],
                asset_id=item["asset_id"],
                model_id=item["model_id"],
                model_version=item["model_version"],
                capability=item["capability"],
                status=item.get("status", "completed"),
                findings=findings,
                scores=item.get("scores") or {},
                runtime_ms=float(item.get("runtime_ms", 0.0)),
                device=item.get("device", "cpu"),
                provenance=item.get("provenance") or {},
                limitations=item.get("limitations") or [],
                error_message=item.get("error_message"),
                created_by=item.get("created_by"),
                created_at=item["created_at"],
            )
        )
    return results


@router.get("/cases/{case_id}/runs/{run_id}", response_model=ModelRunResponse, summary="Get specific model run details")
def get_case_model_run(
    case_id: str,
    run_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ModelRunResponse:
    """
    Retrieve full details, findings, scores, and provenance for a specific model run.
    """
    admin_client = get_supabase_admin_client()

    run_res = (
        admin_client.table("model_runs")
        .select("*")
        .eq("id", run_id)
        .eq("case_id", case_id)
        .maybe_single()
        .execute()
    )
    if run_res is None or not getattr(run_res, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model run with ID '{run_id}' not found for case '{case_id}'.",
        )

    item = run_res.data
    findings_raw = item.get("findings") or []
    findings = [ModelFinding(**f) for f in findings_raw] if findings_raw else []

    return ModelRunResponse(
        id=item["id"],
        case_id=item["case_id"],
        patient_id=item["patient_id"],
        asset_id=item["asset_id"],
        model_id=item["model_id"],
        model_version=item["model_version"],
        capability=item["capability"],
        status=item.get("status", "completed"),
        findings=findings,
        scores=item.get("scores") or {},
        runtime_ms=float(item.get("runtime_ms", 0.0)),
        device=item.get("device", "cpu"),
        provenance=item.get("provenance") or {},
        limitations=item.get("limitations") or [],
        error_message=item.get("error_message"),
        created_by=item.get("created_by"),
        created_at=item["created_at"],
    )


@router.post("/cases/{case_id}/run", response_model=ModelRunResponse, status_code=status.HTTP_201_CREATED, summary="Execute real specialized medical model inference")
async def execute_model_run(
    case_id: str,
    payload: ModelRunRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ModelRunResponse:
    """
    Execute real specialized medical model inference on an ingested medical asset.
    No mock inference, no fake predictions, strictly real PyTorch execution.
    """
    admin_client = get_supabase_admin_client()

    # 1. Verify Case
    case_res = (
        admin_client.table("patient_cases")
        .select("id, patient_id, title, case_number")
        .eq("id", case_id)
        .maybe_single()
        .execute()
    )
    if case_res is None or not getattr(case_res, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clinical case with ID '{case_id}' was not found.",
        )
    case_data = case_res.data
    patient_id = case_data["patient_id"]

    # 2. Verify Asset
    asset_res = (
        admin_client.table("medical_assets")
        .select("*")
        .eq("id", payload.asset_id)
        .eq("case_id", case_id)
        .maybe_single()
        .execute()
    )
    if asset_res is None or not getattr(asset_res, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medical asset with ID '{payload.asset_id}' not found in case '{case_id}'.",
        )
    asset_data = asset_res.data

    # Determine target capability
    target_capability = payload.capability_id
    if not target_capability:
        if payload.model_id and payload.model_id != "torchxrayvision-densenet121":
            target_capability = payload.model_id
        else:
            # Default mapping from asset modality
            if asset_data.get("modality") == "chest_xray":
                target_capability = "pneumonia_screening"
            elif asset_data.get("modality") == "mri":
                target_capability = "brain_tumor_screening"
            elif asset_data.get("modality") == "ct":
                target_capability = "brain_stroke_abnormality_screening"
            elif asset_data.get("modality") == "ecg":
                target_capability = "arrhythmia_cardiac_abnormality_screening"
            elif asset_data.get("modality") == "skin_image":
                target_capability = "skin_lesion_screening"
            else:
                target_capability = "pneumonia_screening"

    # Resolve capability metadata from registry
    cap_meta = adapter_registry.get_capability_metadata(target_capability)
    if not cap_meta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clinical capability '{target_capability}' is not recognized in the capability architecture.",
        )

    # Validate asset modality against capability expected modality
    asset_modality = str(asset_data.get("modality", "")).lower()
    expected_modality = str(cap_meta.get("expected_modality", "")).lower()
    is_compatible = (
        asset_modality == expected_modality
        or (expected_modality == "ct" and asset_modality in ("ct", "mri"))
        or (expected_modality == "chest_xray" and asset_modality in ("chest_xray", "xray"))
    )
    if not is_compatible:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Modality mismatch: Asset is '{asset_modality}', but capability '{target_capability}' "
                f"strictly expects '{expected_modality}'."
            ),
        )

    # Check capability verification and readiness status
    if cap_meta.get("status") != "ready":
        failure_reasons = cap_meta.get("verification_details", {}).get("failure_reasons", ["Model weights or dependencies not configured"])
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Capability '{target_capability}' cannot be executed because its status is NOT_CONFIGURED. "
                f"Verification details: {'; '.join(failure_reasons)}. "
                f"Simulated or fake predictions are strictly prohibited."
            ),
        )

    storage_path = asset_data.get("storage_path")
    if not storage_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset does not have an associated storage path.",
        )

    # 3. Download asset bytes from Supabase Storage
    try:
        raw_bytes = admin_client.storage.from_("medical-assets").download(storage_path)
    except Exception as e:
        logger.error("Failed to download asset from storage (%s): %s", storage_path, str(e))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not retrieve asset bytes from secure storage: {str(e)}",
        ) from e

    # Extract SHA-256 and filename
    asset_metadata = asset_data.get("metadata") or {}
    asset_sha256 = asset_metadata.get("sha256")
    filename = asset_data.get("filename", f"{target_capability}.dat")

    # 4. Execute real inference through resource-aware scheduler
    try:
        inference_result = await resource_scheduler.schedule_and_run(
            capability_id=target_capability,
            asset_bytes=raw_bytes,
            asset_id=payload.asset_id,
            filename=filename,
            asset_sha256=asset_sha256,
            case_id=case_id,
        )
    except ModelResourceUnavailableException:
        # Re-raise to produce clean 503 HTTP response with SIMULATED_RESOURCE_LIMIT if active
        raise
    except Exception as e:
        logger.error("Inference execution failed on asset %s: %s", payload.asset_id, str(e), exc_info=True)
        # Record failure run in database for clinical audit
        failed_payload = {
            "case_id": case_id,
            "patient_id": patient_id,
            "asset_id": payload.asset_id,
            "model_id": cap_meta.get("model_id", target_capability),
            "model_version": "v1",
            "capability": target_capability,
            "status": "failed",
            "findings": [],
            "scores": {},
            "runtime_ms": 0.0,
            "device": "cpu",
            "provenance": {},
            "limitations": [],
            "error_message": str(e),
            "created_by": user.id,
        }
        try:
            admin_client.table("model_runs").insert(failed_payload).execute()
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Specialized model inference failed during execution: {str(e)}",
        ) from e

    # 6. Persist model run to Supabase
    findings_dicts = [f.model_dump() for f in inference_result.findings]
    provenance_dict = inference_result.provenance.model_dump()

    prof = admin_client.table("profiles").select("id").eq("id", user.id).maybe_single().execute()
    created_by = user.id if (prof is not None and getattr(prof, "data", None)) else None

    insert_payload = {
        "case_id": case_id,
        "patient_id": patient_id,
        "asset_id": payload.asset_id,
        "model_id": inference_result.model_id,
        "model_version": inference_result.model_version,
        "capability": inference_result.capability,
        "status": "completed",
        "findings": findings_dicts,
        "scores": inference_result.scores,
        "runtime_ms": inference_result.runtime_ms,
        "device": inference_result.device,
        "provenance": provenance_dict,
        "limitations": inference_result.limitations,
        "error_message": None,
        "created_by": created_by,
    }

    insert_res = admin_client.table("model_runs").insert(insert_payload).execute()
    if not insert_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist model run in database.",
        )
    persisted_run = insert_res.data[0]

    # 7. Record clinical event in patient timeline
    detected_findings = [f.pathology for f in inference_result.findings if f.detected]
    findings_summary = (
        f"{len(detected_findings)} findings flagged ({', '.join(detected_findings[:3])})"
        if detected_findings
        else "No thoracic abnormalities detected above threshold"
    )

    try:
        admin_client.table("clinical_events").insert({
            "patient_id": patient_id,
            "case_id": case_id,
            "event_type": "model_screening_completed",
            "summary": f"Chest X-Ray screening ({inference_result.model_id}): {findings_summary}",
            "metadata": {
                "run_id": persisted_run["id"],
                "model_id": inference_result.model_id,
                "asset_id": payload.asset_id,
                "runtime_ms": inference_result.runtime_ms,
                "detected_findings": detected_findings,
            },
            "created_by": created_by,
        }).execute()
    except Exception as e:
        logger.warning("Could not log clinical timeline event for model run: %s", str(e))

    return ModelRunResponse(
        id=persisted_run["id"],
        case_id=persisted_run["case_id"],
        patient_id=persisted_run["patient_id"],
        asset_id=persisted_run["asset_id"],
        model_id=persisted_run["model_id"],
        model_version=persisted_run["model_version"],
        capability=persisted_run["capability"],
        status=persisted_run["status"],
        findings=inference_result.findings,
        scores=inference_result.scores,
        runtime_ms=inference_result.runtime_ms,
        device=inference_result.device,
        provenance=provenance_dict,
        limitations=inference_result.limitations,
        error_message=None,
        created_by=persisted_run.get("created_by"),
        created_at=persisted_run["created_at"],
    )
