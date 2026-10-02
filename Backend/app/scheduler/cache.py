"""LRU Model Memory Cache Manager for the Resource-Aware Scheduler."""

import gc
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import logging
import torch

from app.models.base import MedicalModel

logger = logging.getLogger(__name__)


@dataclass
class ModelCacheEntry:
    """Metadata tracking a model currently resident in host memory/VRAM."""
    model_id: str
    capability_id: str
    model_instance: MedicalModel
    loaded_at: datetime
    last_accessed_at: datetime
    load_time_ms: float
    estimated_ram_mb: int
    access_count: int = 1
    device: str = "cpu"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_id": self.model_id,
            "capability_id": self.capability_id,
            "loaded_at": self.loaded_at.isoformat(),
            "last_accessed_at": self.last_accessed_at.isoformat(),
            "load_time_ms": round(self.load_time_ms, 2),
            "estimated_ram_mb": self.estimated_ram_mb,
            "access_count": self.access_count,
            "device": self.device,
        }


class ModelCacheManager:
    """
    Manages resident models with Least Recently Used (LRU) memory eviction policy,
    preventing out-of-memory errors and maintaining accurate cache hit/miss metrics.
    """

    def __init__(self, max_resident_models: int = 2, max_resident_ram_mb: int = 2048):
        self.max_resident_models = max_resident_models
        self.max_resident_ram_mb = max_resident_ram_mb
        self._entries: Dict[str, ModelCacheEntry] = {}
        self.hits: int = 0
        self.misses: int = 0
        self.evictions: int = 0

    def get(self, capability_id: str) -> Optional[MedicalModel]:
        """Retrieve model instance from cache if resident, updating LRU access timestamp."""
        if capability_id in self._entries:
            entry = self._entries[capability_id]
            entry.last_accessed_at = datetime.now(timezone.utc)
            entry.access_count += 1
            self.hits += 1
            logger.info("Scheduler Cache HIT for capability '%s'", capability_id)
            return entry.model_instance

        self.misses += 1
        logger.info("Scheduler Cache MISS for capability '%s'", capability_id)
        return None

    def put(
        self,
        capability_id: str,
        model_instance: MedicalModel,
        load_time_ms: float,
        estimated_ram_mb: int = 512,
    ) -> List[str]:
        """
        Store model in cache. If memory limits or model count are exceeded,
        evicts the least recently used model(s). Returns list of evicted capability IDs.
        """
        evicted_ids: List[str] = []

        # If already cached, update entry
        if capability_id in self._entries:
            entry = self._entries[capability_id]
            entry.model_instance = model_instance
            entry.last_accessed_at = datetime.now(timezone.utc)
            entry.load_time_ms = load_time_ms
            entry.estimated_ram_mb = estimated_ram_mb
            return evicted_ids

        # Check eviction needed before adding
        while (
            len(self._entries) >= self.max_resident_models
            or (self.total_resident_ram_mb + estimated_ram_mb) > self.max_resident_ram_mb
        ) and self._entries:
            # Find least recently used entry
            lru_cap_id = min(self._entries.keys(), key=lambda k: self._entries[k].last_accessed_at)
            self.evict(lru_cap_id)
            evicted_ids.append(lru_cap_id)

        # Store new entry
        device = getattr(model_instance, "device", "cpu")
        entry = ModelCacheEntry(
            model_id=model_instance.model_id,
            capability_id=capability_id,
            model_instance=model_instance,
            loaded_at=datetime.now(timezone.utc),
            last_accessed_at=datetime.now(timezone.utc),
            load_time_ms=load_time_ms,
            estimated_ram_mb=estimated_ram_mb,
            device=device,
        )
        self._entries[capability_id] = entry
        logger.info("Cached capability '%s' (%d MB). Active resident count: %d", capability_id, estimated_ram_mb, len(self._entries))
        return evicted_ids

    def evict(self, capability_id: str) -> bool:
        """Explicitly evict and unload a resident model from memory."""
        if capability_id not in self._entries:
            return False

        entry = self._entries.pop(capability_id)
        try:
            entry.model_instance.unload()
        except Exception as e:
            logger.warning("Error during model unload for '%s': %s", capability_id, e)

        # Trigger garbage collection and cuda cache empty
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        self.evictions += 1
        logger.info("Evicted capability '%s' from cache. Reclaimed ~%d MB.", capability_id, entry.estimated_ram_mb)
        return True

    def evict_all(self) -> int:
        """Evict all resident models from memory."""
        keys = list(self._entries.keys())
        for k in keys:
            self.evict(k)
        return len(keys)

    @property
    def total_resident_ram_mb(self) -> int:
        return sum(e.estimated_ram_mb for e in self._entries.values())

    def get_metrics(self) -> Dict[str, Any]:
        total_requests = self.hits + self.misses
        hit_rate = (self.hits / total_requests * 100.0) if total_requests > 0 else 0.0

        return {
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate_percent": round(hit_rate, 1),
            "evictions": self.evictions,
            "resident_count": len(self._entries),
            "max_resident_models": self.max_resident_models,
            "total_resident_ram_mb": self.total_resident_ram_mb,
            "max_resident_ram_mb": self.max_resident_ram_mb,
            "resident_models": [e.to_dict() for e in self._entries.values()],
        }


# Global model cache manager singleton
model_cache = ModelCacheManager()
