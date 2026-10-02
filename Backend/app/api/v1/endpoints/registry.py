import logging
from datetime import datetime, timezone
from typing import List, Optional
import torch
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import AuthenticatedUser, get_current_user
from app.core.supabase import get_supabase_admin_client
from app.models.manager import model_manager
from app.schemas.registry import (
    ModelCompatibilityResponse,
    ModelHealthResponse,
    ModelRegisterRequest,
    ModelRegistryResponse,
    ModelUpdateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/models", response_model=List[ModelRegistryResponse], summary="List registered medical models")
def list_registry_models(
    modality: Optional[str] = Query(None, description="Filter by modality (e.g. chest_xray, mri, ct, ecg)"),
    capability: Optional[str] = Query(None, description="Filter by capability"),
    domain: Optional[str] = Query(None, description="Filter by clinical domain"),
    model_status: Optional[str] = Query(None, alias="status", description="Filter by status"),
    user: AuthenticatedUser = Depends(get_current_user),
) -> List[ModelRegistryResponse]:
    """
    Retrieve all specialized medical models registered in the database.
    Supports filtering by clinical domain, modality, capability, and operational status.
    """
    admin_client = get_supabase_admin_client()
    query = admin_client.table("model_registry").select("*").order("name")

    if modality:
        query = query.eq("modality", modality)
    if domain:
        query = query.eq("domain", domain)
    if model_status:
        query = query.eq("status", model_status)

    res = query.execute()
    records = res.data or []

    results: List[ModelRegistryResponse] = []
    for item in records:
        # Check capability filter if specified (array containment)
        if capability and capability not in (item.get("capabilities") or []):
            continue

        # Check live runtime status if active model
        live_status = item.get("status")
        if item["id"] == "torchxrayvision-densenet121":
            runtime_info = model_manager.get_status("torchxrayvision-densenet121")
            live_status = runtime_info.status.value.lower()

        results.append(ModelRegistryResponse(**item, runtime_status=live_status))

    return results


@router.get("/models/{model_id}", response_model=ModelRegistryResponse, summary="Get details for a registered model")
def get_registry_model(
    model_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ModelRegistryResponse:
    """
    Retrieve full metadata, resource estimates, provenance, and limitations for a registered model.
    """
    admin_client = get_supabase_admin_client()
    res = (
        admin_client.table("model_registry")
        .select("*")
        .eq("id", model_id)
        .maybe_single()
        .execute()
    )
    if res is None or not getattr(res, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model with ID '{model_id}' is not found in the model registry.",
        )

    item = res.data
    live_status = item.get("status")
    if model_id == "torchxrayvision-densenet121":
        runtime_info = model_manager.get_status("torchxrayvision-densenet121")
        live_status = runtime_info.status.value.lower()

    return ModelRegistryResponse(**item, runtime_status=live_status)


@router.post("/models", response_model=ModelRegistryResponse, status_code=status.HTTP_201_CREATED, summary="Register a new specialized medical model")
def register_model(
    payload: ModelRegisterRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ModelRegistryResponse:
    """
    Register a new clinical AI model in the database-backed registry.
    """
    admin_client = get_supabase_admin_client()

    # Check for duplicate ID
    existing = (
        admin_client.table("model_registry")
        .select("id")
        .eq("id", payload.id)
        .maybe_single()
        .execute()
    )
    if existing and getattr(existing, "data", None):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Model with ID '{payload.id}' already exists in registry.",
        )

    insert_data = payload.model_dump()
    res = admin_client.table("model_registry").insert(insert_data).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register model in database.",
        )

    item = res.data[0]
    return ModelRegistryResponse(**item, runtime_status=item.get("status"))


@router.patch("/models/{model_id}", response_model=ModelRegistryResponse, summary="Update an existing registered model")
def update_registry_model(
    model_id: str,
    payload: ModelUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ModelRegistryResponse:
    """
    Update configuration, resource specifications, or status of a registered model.
    """
    admin_client = get_supabase_admin_client()

    # Check existence
    existing = (
        admin_client.table("model_registry")
        .select("id")
        .eq("id", model_id)
        .maybe_single()
        .execute()
    )
    if existing is None or not getattr(existing, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model with ID '{model_id}' was not found in registry.",
        )

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid update fields provided.",
        )

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = admin_client.table("model_registry").update(update_data).eq("id", model_id).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update model in database.",
        )

    item = res.data[0]
    return ModelRegistryResponse(**item, runtime_status=item.get("status"))


@router.get("/compatibility", response_model=ModelCompatibilityResponse, summary="Query compatible models for modality/capability")
def query_model_compatibility(
    modality: str = Query(..., description="Target asset modality (e.g. chest_xray, mri, ct, ecg, skin_image)"),
    capability: Optional[str] = Query(None, description="Optional target capability"),
    user: AuthenticatedUser = Depends(get_current_user),
) -> ModelCompatibilityResponse:
    """
    Resolve and return all compatible models for a given medical modality or capability.
    Enables frontend and orchestrator to dynamically discover candidate models without hard-coding.
    """
    admin_client = get_supabase_admin_client()
    res = (
        admin_client.table("model_registry")
        .select("*")
        .eq("modality", modality)
        .execute()
    )

    records = res.data or []
    compatible: List[ModelRegistryResponse] = []

    for item in records:
        if capability and capability not in (item.get("capabilities") or []):
            continue

        live_status = item.get("status")
        if item["id"] == "torchxrayvision-densenet121":
            runtime_info = model_manager.get_status("torchxrayvision-densenet121")
            live_status = runtime_info.status.value.lower()

        compatible.append(ModelRegistryResponse(**item, runtime_status=live_status))

    # Sort so ready/active models appear first
    compatible.sort(key=lambda m: (m.runtime_status != "ready", m.name))

    return ModelCompatibilityResponse(
        modality=modality,
        capability=capability,
        compatible_models=compatible,
        count=len(compatible),
    )


@router.get("/models/{model_id}/health", response_model=ModelHealthResponse, summary="Inspect dynamic runtime health of a model")
def get_model_health(
    model_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ModelHealthResponse:
    """
    Query the real-time operational health, dependencies, and accelerator status of a registered model.
    """
    admin_client = get_supabase_admin_client()
    res = (
        admin_client.table("model_registry")
        .select("*")
        .eq("id", model_id)
        .maybe_single()
        .execute()
    )
    if res is None or not getattr(res, "data", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model with ID '{model_id}' was not found in registry.",
        )

    db_record = res.data
    now_iso = datetime.now(timezone.utc).isoformat()

    if model_id == "torchxrayvision-densenet121":
        runtime_status = model_manager.get_status("torchxrayvision-densenet121")
        return ModelHealthResponse(
            model_id=model_id,
            status=runtime_status.status.value,
            runtime_ready=runtime_status.status.value == "READY",
            device=runtime_status.device,
            gpu_available=runtime_status.gpu_available,
            weights_present=runtime_status.weights_available,
            dependencies_ready=runtime_status.dependencies_installed,
            last_verified_at=now_iso,
            details={
                "message": runtime_status.status_message,
                "pathologies_supported": len(runtime_status.pathologies),
                "framework": "torchxrayvision",
                "torch_version": torch.__version__,
                "estimated_ram_mb": db_record.get("estimated_ram_mb"),
                "estimated_vram_mb": db_record.get("estimated_vram_mb"),
            },
        )

    # For unconfigured models
    return ModelHealthResponse(
        model_id=model_id,
        status=db_record.get("status", "not_configured"),
        runtime_ready=False,
        device="none",
        gpu_available=torch.cuda.is_available(),
        weights_present=False,
        dependencies_ready=False,
        last_verified_at=now_iso,
        details={
            "message": f"Model '{model_id}' is registered in database but not yet loaded or configured in local runtime environment.",
            "artifact_source": db_record.get("artifact_source"),
            "target_modality": db_record.get("modality"),
            "target_capabilities": db_record.get("capabilities"),
        },
    )
