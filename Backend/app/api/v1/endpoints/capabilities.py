import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import AuthenticatedUser, get_current_user
from app.core.supabase import get_supabase_admin_client
from app.models.registry import adapter_registry
from app.schemas.capabilities import (
    CapabilityHealthResponse,
    CapabilityResolveResponse,
    ClinicalCapabilityResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=List[ClinicalCapabilityResponse], summary="List all six clinical capabilities")
def list_capabilities(
    modality: Optional[str] = Query(None, description="Filter by modality (e.g. chest_xray, mri, ct, ecg, skin_image)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status ('ready' or 'not_configured')"),
    runnable_only: bool = Query(False, description="If true, only returns capabilities that are verified and ready to run"),
    user: AuthenticatedUser = Depends(get_current_user),
) -> List[ClinicalCapabilityResponse]:
    """
    Retrieve all registered clinical capabilities in the six-capability architecture.
    Synchronizes database metadata with live Python runtime adapter verification.
    """
    admin_client = get_supabase_admin_client()

    # Query DB records
    try:
        db_res = admin_client.table("clinical_capabilities").select("*").order("name").execute()
        db_records = db_res.data or []
    except Exception as e:
        logger.warning("Could not query DB clinical_capabilities, falling back to in-memory registry: %s", str(e))
        db_records = []

    # Map by capability_id
    db_map = {r["capability_id"]: r for r in db_records}

    # Discover from adapter registry (authoritative for 6 capabilities)
    all_caps = adapter_registry.list_capabilities()
    results: List[ClinicalCapabilityResponse] = []

    for cap in all_caps:
        cap_id = cap["capability_id"]
        db_rec = db_map.get(cap_id, {})

        # Merge DB timestamps / extra fields if present
        created_at = db_rec.get("created_at")
        updated_at = db_rec.get("updated_at")

        item = ClinicalCapabilityResponse(
            capability_id=cap_id,
            name=cap["name"],
            description=cap["description"],
            expected_modality=cap["expected_modality"],
            adapter_class=cap["adapter_class"],
            preprocessing_contract=cap["preprocessing_contract"],
            output_schema=cap["output_schema"],
            model_source=cap["model_source"],
            provenance=cap["provenance"],
            limitations=cap["limitations"],
            license=cap["license"],
            status=cap["status"],
            model_id=cap.get("model_id"),
            verification_details=cap.get("verification_details", {}),
            created_at=created_at,
            updated_at=updated_at,
        )

        # Modality filter
        if modality and item.expected_modality.lower() != modality.lower():
            # Check secondary compatibility
            if not (item.expected_modality.lower() == "ct" and modality.lower() == "mri" and "stroke" in cap_id):
                continue

        # Status filter
        if status_filter and item.status.lower() != status_filter.lower():
            continue

        # Runnable only filter
        if runnable_only and item.status.lower() != "ready":
            continue

        results.append(item)

    # Sort runnable first
    results.sort(key=lambda c: (c.status != "ready", c.name))
    return results


@router.get("/resolve", response_model=CapabilityResolveResponse, summary="Resolve compatible capabilities for a modality")
def resolve_capabilities(
    modality: str = Query(..., description="Medical modality to resolve capabilities for (e.g. chest_xray, mri, ct, ecg, skin_image)"),
    runnable_only: bool = Query(False, description="Filter to only verified and runnable capabilities"),
    user: AuthenticatedUser = Depends(get_current_user),
) -> CapabilityResolveResponse:
    """
    Capability Resolver:
    Inspects input asset modality and dynamically resolves candidate capabilities.
    For compatible cases, returns matching runnable and unconfigured capabilities with explicit status.
    """
    resolved = adapter_registry.resolve_capabilities(modality=modality, runnable_only=runnable_only)
    items = [ClinicalCapabilityResponse(**r) for r in resolved]

    return CapabilityResolveResponse(
        modality=modality,
        runnable_only=runnable_only,
        capabilities=items,
        count=len(items),
    )


@router.get("/{capability_id}", response_model=ClinicalCapabilityResponse, summary="Get capability specification and status")
def get_capability(
    capability_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> ClinicalCapabilityResponse:
    """
    Retrieve full specification, contracts, provenance, and verification report for a capability.
    """
    meta = adapter_registry.get_capability_metadata(capability_id)
    if not meta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clinical capability '{capability_id}' not found in registry.",
        )

    return ClinicalCapabilityResponse(**meta)


@router.get("/{capability_id}/health", response_model=CapabilityHealthResponse, summary="Live health verification check")
def get_capability_health(
    capability_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> CapabilityHealthResponse:
    """
    Perform a real-time verification audit on the capability across 9 clinical AI criteria:
    license, input, preprocessing, labels, outputs, weights, dependencies, limitations, hardware requirements.
    """
    health = adapter_registry.check_health(capability_id)
    if health.get("status") == "NOT_CONFIGURED" and "not found" in health.get("verification_details", {}).get("failure_reasons", [""])[0]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clinical capability '{capability_id}' not found in registry.",
        )

    return CapabilityHealthResponse(**health)
