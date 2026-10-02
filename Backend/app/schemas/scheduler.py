"""Pydantic schemas for Phase 8 Resource-Aware Scheduler."""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class SimulatedLimitRequest(BaseModel):
    """Request payload to configure optional simulated constrained-resource mode."""
    enabled: bool
    max_ram_mb: Optional[int] = Field(default=None, description="Simulated maximum RAM allocation in MB")
    max_vram_mb: Optional[int] = Field(default=None, description="Simulated maximum VRAM allocation in MB")


class SimulatedLimitResponse(BaseModel):
    """Response showing current status of simulated limits."""
    enabled: bool
    simulated_max_ram_mb: int
    simulated_max_vram_mb: int
    simulated_busy_cpu: bool
    label: str = "SIMULATED_RESOURCE_LIMIT"
    description: str


class SchedulerDashboardResponse(BaseModel):
    """Comprehensive telemetry, memory estimates, loaded models, and queue state."""
    telemetry: Dict[str, Any]
    simulation: Dict[str, Any]
    cache: Dict[str, Any]
    memory_estimates: List[Dict[str, Any]]
    queue: Dict[str, Any]
    recent_events: List[Dict[str, Any]]


class UnloadResponse(BaseModel):
    """Result of unloading one or all resident models from memory."""
    success: bool
    message: str
    reclaimed_mb: Optional[int] = None
    remaining_resident_count: int
