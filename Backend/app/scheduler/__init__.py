"""MediFusion AI Resource-Aware Scheduler Package."""

from app.scheduler.state import (
    HardwareTelemetry,
    SimulatedResourceConfig,
    get_hardware_telemetry,
    evaluate_resource_availability,
    simulated_config,
)
from app.scheduler.cache import (
    ModelCacheEntry,
    ModelCacheManager,
    model_cache,
)
from app.scheduler.events import (
    SchedulerEvent,
    SchedulerEventManager,
    scheduler_events,
)
from app.scheduler.queue import (
    ScheduledTask,
    ConcurrencyQueueManager,
    scheduler_queue,
)
from app.scheduler.manager import (
    ResourceAwareScheduler,
    resource_scheduler,
)

__all__ = [
    "HardwareTelemetry",
    "SimulatedResourceConfig",
    "get_hardware_telemetry",
    "evaluate_resource_availability",
    "simulated_config",
    "ModelCacheEntry",
    "ModelCacheManager",
    "model_cache",
    "SchedulerEvent",
    "SchedulerEventManager",
    "scheduler_events",
    "ScheduledTask",
    "ConcurrencyQueueManager",
    "scheduler_queue",
    "ResourceAwareScheduler",
    "resource_scheduler",
]
