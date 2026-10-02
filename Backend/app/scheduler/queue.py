"""Concurrent run protection, request queueing, and timeout controls."""

import asyncio
import time
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)


@dataclass
class ScheduledTask:
    """An inference task tracked inside the scheduler queue."""
    task_id: str
    capability_id: str
    model_id: str
    case_id: Optional[str]
    status: str  # 'queued', 'running', 'completed', 'failed', 'timed_out'
    enqueued_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    runtime_ms: Optional[float] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ConcurrencyQueueManager:
    """
    Guarantees concurrency safety across model invocations:
    - Per-capability async locks to prevent simultaneous weight corruption
    - Global inference semaphore to prevent CPU/RAM thrashing
    - Timeout safety watchdog (default 30 seconds)
    """

    def __init__(self, max_concurrency: int = 2, default_timeout_seconds: float = 30.0):
        self.max_concurrency = max_concurrency
        self.default_timeout_seconds = default_timeout_seconds
        self._semaphore: Optional[asyncio.Semaphore] = None
        self._capability_locks: Dict[str, asyncio.Lock] = {}
        self._active_tasks: Dict[str, ScheduledTask] = {}
        self._recent_completed: List[ScheduledTask] = []
        self.total_completed: int = 0
        self.total_failed: int = 0
        self.total_timed_out: int = 0

    def _get_semaphore(self) -> asyncio.Semaphore:
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(self.max_concurrency)
        return self._semaphore

    def _get_lock(self, capability_id: str) -> asyncio.Lock:
        if capability_id not in self._capability_locks:
            self._capability_locks[capability_id] = asyncio.Lock()
        return self._capability_locks[capability_id]

    def register_task(
        self,
        capability_id: str,
        model_id: str,
        case_id: Optional[str] = None,
    ) -> ScheduledTask:
        task_id = str(uuid.uuid4())
        task = ScheduledTask(
            task_id=task_id,
            capability_id=capability_id,
            model_id=model_id,
            case_id=case_id,
            status="queued",
            enqueued_at=datetime.now(timezone.utc).isoformat(),
        )
        self._active_tasks[task_id] = task
        return task

    def mark_running(self, task_id: str) -> None:
        if task_id in self._active_tasks:
            task = self._active_tasks[task_id]
            task.status = "running"
            task.started_at = datetime.now(timezone.utc).isoformat()

    def mark_completed(self, task_id: str, runtime_ms: float) -> None:
        if task_id in self._active_tasks:
            task = self._active_tasks.pop(task_id)
            task.status = "completed"
            task.completed_at = datetime.now(timezone.utc).isoformat()
            task.runtime_ms = round(runtime_ms, 2)
            self._recent_completed.append(task)
            if len(self._recent_completed) > 50:
                self._recent_completed.pop(0)
            self.total_completed += 1

    def mark_failed(self, task_id: str, error: str, is_timeout: bool = False) -> None:
        if task_id in self._active_tasks:
            task = self._active_tasks.pop(task_id)
            task.status = "timed_out" if is_timeout else "failed"
            task.completed_at = datetime.now(timezone.utc).isoformat()
            task.error = error
            self._recent_completed.append(task)
            if len(self._recent_completed) > 50:
                self._recent_completed.pop(0)
            if is_timeout:
                self.total_timed_out += 1
            else:
                self.total_failed += 1

    def get_queue_status(self) -> Dict[str, Any]:
        return {
            "concurrency_limit": self.max_concurrency,
            "active_tasks_count": len(self._active_tasks),
            "active_tasks": [t.to_dict() for t in self._active_tasks.values()],
            "recently_completed": [t.to_dict() for t in self._recent_completed[-10:]],
            "total_completed": self.total_completed,
            "total_failed": self.total_failed,
            "total_timed_out": self.total_timed_out,
            "default_timeout_seconds": self.default_timeout_seconds,
        }


# Global queue manager singleton
scheduler_queue = ConcurrencyQueueManager()
