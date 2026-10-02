"""Scheduler lifecycle event auditing and persistence for MediFusion AI."""

import uuid
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from collections import deque
import logging

from app.core.supabase import get_supabase_admin_client

logger = logging.getLogger(__name__)


@dataclass
class SchedulerEvent:
    """Audit record capturing a discrete scheduler lifecycle transition."""
    id: str
    stage: str  # SELECT, RESOURCE_CHECK, LOAD, INFER, PERSIST, CACHE, UNLOAD, ERROR
    status: str  # success, warning, error, info
    message: str
    model_id: Optional[str] = None
    capability_id: Optional[str] = None
    case_id: Optional[str] = None
    load_time_ms: Optional[float] = None
    inference_time_ms: Optional[float] = None
    memory_mb: Optional[int] = None
    is_simulated: bool = False
    error_code: Optional[str] = None
    metadata: Dict[str, Any] = None
    created_at: str = None

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid.uuid4())
        if not self.created_at:
            self.created_at = datetime.now(timezone.utc).isoformat()
        if self.metadata is None:
            self.metadata = {}

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if self.load_time_ms is not None:
            d["load_time_ms"] = round(self.load_time_ms, 2)
        if self.inference_time_ms is not None:
            d["inference_time_ms"] = round(self.inference_time_ms, 2)
        return d


class SchedulerEventManager:
    """Manages circular in-memory buffer and asynchronous DB logging for scheduler events."""

    def __init__(self, max_buffer_size: int = 150):
        self._events: deque[SchedulerEvent] = deque(maxlen=max_buffer_size)

    def log_event(
        self,
        stage: str,
        message: str,
        status: str = "info",
        model_id: Optional[str] = None,
        capability_id: Optional[str] = None,
        case_id: Optional[str] = None,
        load_time_ms: Optional[float] = None,
        inference_time_ms: Optional[float] = None,
        memory_mb: Optional[int] = None,
        is_simulated: bool = False,
        error_code: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SchedulerEvent:
        """Create, buffer, and persist a scheduler lifecycle event."""
        event = SchedulerEvent(
            id=str(uuid.uuid4()),
            stage=stage,
            status=status,
            message=message,
            model_id=model_id,
            capability_id=capability_id,
            case_id=case_id,
            load_time_ms=load_time_ms,
            inference_time_ms=inference_time_ms,
            memory_mb=memory_mb,
            is_simulated=is_simulated,
            error_code=error_code,
            metadata=metadata or {},
            created_at=datetime.now(timezone.utc).isoformat(),
        )

        self._events.appendleft(event)
        logger.info("[Scheduler:%s:%s] %s", stage, status.upper(), message)

        # Asynchronously attempt persistence to Supabase
        try:
            admin_client = get_supabase_admin_client()
            record = event.to_dict()
            admin_client.table("scheduler_events").insert(record).execute()
        except Exception:
            # Fallback gracefully for offline/test environments
            pass

        return event

    def get_recent_events(
        self,
        limit: int = 50,
        stage: Optional[str] = None,
        model_id: Optional[str] = None,
        case_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve recent scheduler events from the buffer."""
        filtered = list(self._events)
        if stage:
            filtered = [e for e in filtered if e.stage == stage]
        if model_id:
            filtered = [e for e in filtered if e.model_id == model_id]
        if case_id:
            filtered = [e for e in filtered if e.case_id == case_id]

        return [e.to_dict() for e in filtered[:limit]]


# Global scheduler event manager singleton
scheduler_events = SchedulerEventManager()
