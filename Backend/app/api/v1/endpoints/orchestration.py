"""API endpoints for Phase 7 Intelligent Model Orchestrator."""

from typing import List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, status
from app.core.security import AuthenticatedUser, get_current_user
from app.core.supabase import get_supabase_admin_client
from app.orchestration.core import model_orchestrator
from app.orchestration.resource_state import inspect_resource_state
from app.schemas.orchestration import (
    OrchestrationPlanCreate,
    OrchestrationPlanResponse,
)

router = APIRouter()


@router.post(
    "/cases/{case_id}/plan",
    response_model=OrchestrationPlanResponse,
    summary="Generate or update deterministic model orchestration plan for a case",
)
async def generate_case_orchestration_plan(
    case_id: str,
    payload: Optional[OrchestrationPlanCreate] = Body(default=None),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> OrchestrationPlanResponse:

    """Execute the deterministic 9-step model orchestration algorithm for a clinical case."""
    admin_client = get_supabase_admin_client()

    # 1. Fetch case details
    try:
        case_res = (
            admin_client.table("patient_cases")
            .select("*")
            .eq("id", case_id)
            .single()
            .execute()
        )
        if not case_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Clinical case with ID '{case_id}' was not found.",
            )
        case_data = case_res.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve case: {str(e)}",
        )

    patient_id = case_data.get("patient_id")

    # 2. Fetch medical assets for the case
    try:
        assets_res = (
            admin_client.table("medical_assets")
            .select("*")
            .eq("case_id", case_id)
            .order("created_at", desc=False)
            .execute()
        )
        assets = assets_res.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve assets for case '{case_id}': {str(e)}",
        )

    symptoms_context = payload.symptoms_context if payload else None
    if isinstance(symptoms_context, list):
        symptoms_context = " ".join(str(s) for s in symptoms_context)
    force_replan = payload.force_replan if payload else False


    # 3. Execute 9-step orchestration
    try:
        plan_dict = model_orchestrator.plan_case_execution(
            case_id=case_id,
            patient_id=patient_id,
            case_metadata=case_data,
            assets=assets,
            symptoms_context=symptoms_context,
            created_by=current_user.id,
            force_replan=force_replan,
        )
        return OrchestrationPlanResponse(**plan_dict)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model orchestration failed: {str(e)}",
        )


@router.get(
    "/cases/{case_id}/plan",
    response_model=OrchestrationPlanResponse,
    summary="Get latest orchestration plan for a case (auto-generates if none exists)",
)
async def get_case_orchestration_plan(
    case_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> OrchestrationPlanResponse:
    """Retrieve the current active orchestration plan for a case, or compute one if none exists."""
    admin_client = get_supabase_admin_client()

    try:
        res = (
            admin_client.table("orchestration_plans")
            .select("*")
            .eq("case_id", case_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data and len(res.data) > 0:
            return OrchestrationPlanResponse(**res.data[0])
    except Exception as e:
        pass

    # Fallback to generating a fresh plan
    return await generate_case_orchestration_plan(
        case_id=case_id,
        payload=None,
        current_user=current_user,
    )


@router.get(
    "/plans/{plan_id}",
    response_model=OrchestrationPlanResponse,
    summary="Retrieve orchestration plan by ID",
)
async def get_orchestration_plan_by_id(
    plan_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> OrchestrationPlanResponse:
    """Fetch an immutable persisted orchestration plan record by UUID."""
    admin_client = get_supabase_admin_client()

    try:
        res = (
            admin_client.table("orchestration_plans")
            .select("*")
            .eq("id", plan_id)
            .single()
            .execute()
        )
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Orchestration plan '{plan_id}' not found.",
            )
        return OrchestrationPlanResponse(**res.data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve plan: {str(e)}",
        )


@router.get(
    "/resources",
    summary="Get real-time compute and memory resource snapshot",
)
async def get_system_resources(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """Inspect host system RAM, CPU cores, and CUDA VRAM headroom."""
    snapshot = inspect_resource_state()
    return snapshot.to_dict()
