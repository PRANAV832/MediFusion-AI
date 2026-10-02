"""API endpoints for Phase 8 Resource-Aware Scheduler."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import AuthenticatedUser, get_current_user
from app.scheduler.manager import resource_scheduler
from app.scheduler.cache import model_cache
from app.scheduler.events import scheduler_events
from app.scheduler.state import simulated_config
from app.schemas.scheduler import (
    SimulatedLimitRequest,
    SimulatedLimitResponse,
    SchedulerDashboardResponse,
    UnloadResponse,
)

router = APIRouter()


@router.get(
    "/dashboard",
    response_model=SchedulerDashboardResponse,
    summary="Get complete scheduler telemetry, cache, memory estimates, queue, and recent events",
)
async def get_scheduler_dashboard(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> SchedulerDashboardResponse:
    """Retrieve comprehensive resource telemetry, cache hits/misses, resident models, and task queue."""
    data = resource_scheduler.get_dashboard_data()
    return SchedulerDashboardResponse(**data)


@router.post(
    "/simulated-limits",
    response_model=SimulatedLimitResponse,
    summary="Configure optional simulated constrained-resource mode",
)
async def configure_simulated_limits(
    payload: SimulatedLimitRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> SimulatedLimitResponse:
    """
    Enable or disable simulated constrained-resource demo mode.
    When enabled, the API and UI will explicitly display 'SIMULATED_RESOURCE_LIMIT'.
    """
    updated = resource_scheduler.set_simulation_mode(
        enabled=payload.enabled,
        max_ram_mb=payload.max_ram_mb,
        max_vram_mb=payload.max_vram_mb,
    )
    return SimulatedLimitResponse(**updated)


@router.post(
    "/models/{capability_id}/unload",
    response_model=UnloadResponse,
    summary="Explicitly evict and unload a resident model from memory",
)
async def unload_model(
    capability_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> UnloadResponse:
    """Explicitly evicts a model from resident memory, triggering gc and VRAM release."""
    success = resource_scheduler.unload_model(capability_id)
    cache_metrics = model_cache.get_metrics()
    return UnloadResponse(
        success=success,
        message=f"Model for '{capability_id}' {'unloaded successfully' if success else 'was not resident in cache'}.",
        remaining_resident_count=cache_metrics["resident_count"],
    )


@router.post(
    "/unload-all",
    response_model=UnloadResponse,
    summary="Explicitly evict all resident models from memory",
)
async def unload_all_models(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> UnloadResponse:
    """Evicts all models from resident memory, reclaiming all allocated host RAM/VRAM."""
    count = resource_scheduler.unload_all()
    return UnloadResponse(
        success=True,
        message=f"All resident models evicted from cache ({count} unloaded).",
        remaining_resident_count=0,
    )


@router.get(
    "/events",
    summary="List recent scheduler lifecycle events with optional filters",
)
async def get_scheduler_events(
    limit: int = Query(default=50, ge=1, le=150),
    stage: Optional[str] = Query(default=None),
    model_id: Optional[str] = Query(default=None),
    case_id: Optional[str] = Query(default=None),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> List[dict]:
    """Retrieve chronological audit stream of scheduler lifecycle events."""
    return scheduler_events.get_recent_events(
        limit=limit,
        stage=stage,
        model_id=model_id,
        case_id=case_id,
    )
