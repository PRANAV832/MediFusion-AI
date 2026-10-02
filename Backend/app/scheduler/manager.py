"""Resource-Aware Scheduler Manager implementing the complete 6-stage lifecycle."""

import asyncio
import time
import logging
from typing import Dict, Any, Optional, List

from app.core.exceptions import ModelResourceUnavailableException
from app.models.registry import adapter_registry
from app.schemas.model_run import NormalizedInferenceResult
from app.scheduler.state import (
    get_hardware_telemetry,
    evaluate_resource_availability,
    simulated_config,
)
from app.scheduler.cache import model_cache
from app.scheduler.events import scheduler_events
from app.scheduler.queue import scheduler_queue

logger = logging.getLogger(__name__)


class ResourceAwareScheduler:
    """
    Coordinates model execution through strict resource-aware scheduling:
    SELECT -> RESOURCE CHECK -> LOAD -> INFER -> PERSIST -> CACHE/UNLOAD.
    """

    async def schedule_and_run(
        self,
        capability_id: str,
        asset_bytes: bytes,
        asset_id: str,
        filename: Optional[str] = None,
        asset_sha256: Optional[str] = None,
        case_id: Optional[str] = None,
        timeout_seconds: float = 30.0,
    ) -> NormalizedInferenceResult:
        """
        Execute the full 6-stage scheduler lifecycle for a clinical inference request.
        """
        # =====================================================================
        # STAGE 1: SELECT
        # =====================================================================
        cap_meta = adapter_registry.get_capability(capability_id)
        adapter = adapter_registry.get_adapter(capability_id)

        if not cap_meta or not adapter:
            raise ValueError(f"Capability '{capability_id}' not found in registry.")

        model_id = adapter.model_id
        estimated_ram_mb = cap_meta.get("estimated_ram_mb", 512)
        estimated_vram_mb = cap_meta.get("estimated_vram_mb", 0)

        # Enforce readiness - zero fake predictions
        verification = adapter.verify()
        if not verification.get("verified", False):
            reasons = "; ".join(verification.get("failure_reasons", ["Unconfigured"]))
            scheduler_events.log_event(
                stage="SELECT",
                status="error",
                message=f"Model '{model_id}' is NOT_CONFIGURED ({reasons}). Execution rejected.",
                model_id=model_id,
                capability_id=capability_id,
                case_id=case_id,
                error_code="NOT_CONFIGURED",
            )
            raise ValueError(f"Capability '{capability_id}' is NOT_CONFIGURED: {reasons}")

        scheduler_events.log_event(
            stage="SELECT",
            status="info",
            message=f"Selected candidate model '{model_id}' for capability '{cap_meta['name']}'.",
            model_id=model_id,
            capability_id=capability_id,
            case_id=case_id,
            memory_mb=estimated_ram_mb,
        )

        # =====================================================================
        # STAGE 2: RESOURCE CHECK
        # =====================================================================
        available, res_msg, is_simulated, error_code = evaluate_resource_availability(
            required_ram_mb=estimated_ram_mb,
            required_vram_mb=estimated_vram_mb,
            safety_margin_mb=256,
        )

        if not available:
            scheduler_events.log_event(
                stage="RESOURCE_CHECK",
                status="error",
                message=res_msg,
                model_id=model_id,
                capability_id=capability_id,
                case_id=case_id,
                memory_mb=estimated_ram_mb,
                is_simulated=is_simulated,
                error_code=error_code or "MODEL_RESOURCE_UNAVAILABLE",
            )
            raise ModelResourceUnavailableException(
                message=res_msg,
                details={
                    "error_code": "MODEL_RESOURCE_UNAVAILABLE",
                    "is_simulated": is_simulated,
                    "simulated_label": "SIMULATED_RESOURCE_LIMIT" if is_simulated else None,
                    "required_ram_mb": estimated_ram_mb,
                },
            )

        scheduler_events.log_event(
            stage="RESOURCE_CHECK",
            status="success",
            message=res_msg,
            model_id=model_id,
            capability_id=capability_id,
            case_id=case_id,
            memory_mb=estimated_ram_mb,
            is_simulated=is_simulated,
        )

        # =====================================================================
        # STAGE 3: LOAD (Cache Check / Weight Loading)
        # =====================================================================
        cached_instance = model_cache.get(capability_id)
        load_time_ms = 0.0

        if cached_instance:
            scheduler_events.log_event(
                stage="CACHE",
                status="info",
                message=f"Cache HIT: Model '{model_id}' is already resident in memory.",
                model_id=model_id,
                capability_id=capability_id,
                case_id=case_id,
                memory_mb=estimated_ram_mb,
            )
            active_adapter = cached_instance
        else:
            scheduler_events.log_event(
                stage="CACHE",
                status="info",
                message=f"Cache MISS: Model '{model_id}' must be loaded into memory.",
                model_id=model_id,
                capability_id=capability_id,
                case_id=case_id,
            )

            load_start = time.perf_counter()
            adapter.load()
            load_end = time.perf_counter()
            load_time_ms = (load_end - load_start) * 1000.0

            evicted = model_cache.put(
                capability_id=capability_id,
                model_instance=adapter,
                load_time_ms=load_time_ms,
                estimated_ram_mb=estimated_ram_mb,
            )

            if evicted:
                scheduler_events.log_event(
                    stage="UNLOAD",
                    status="warning",
                    message=f"LRU memory reclamation evicted: {', '.join(evicted)}",
                    model_id=model_id,
                    capability_id=capability_id,
                    case_id=case_id,
                )

            scheduler_events.log_event(
                stage="LOAD",
                status="success",
                message=f"Loaded '{model_id}' into memory in {load_time_ms:.1f} ms.",
                model_id=model_id,
                capability_id=capability_id,
                case_id=case_id,
                load_time_ms=load_time_ms,
                memory_mb=estimated_ram_mb,
            )
            active_adapter = adapter

        # =====================================================================
        # STAGE 4: INFER (Concurrency Guard & Timeout Protection)
        # =====================================================================
        task = scheduler_queue.register_task(
            capability_id=capability_id,
            model_id=model_id,
            case_id=case_id,
        )

        semaphore = scheduler_queue._get_semaphore()
        lock = scheduler_queue._get_lock(capability_id)

        async with semaphore:
            async with lock:
                scheduler_queue.mark_running(task.task_id)

                async def _execute_inference():
                    loop = asyncio.get_running_loop()
                    infer_start = time.perf_counter()

                    def _sync_forward():
                        preprocessed = active_adapter.preprocess(asset_bytes)
                        return active_adapter.predict(preprocessed)

                    raw_output = await loop.run_in_executor(None, _sync_forward)
                    infer_end = time.perf_counter()
                    infer_time = (infer_end - infer_start) * 1000.0

                    result = active_adapter.postprocess(
                        raw_predictions=raw_output,
                        input_asset_id=asset_id,
                        runtime_ms=infer_time,
                        input_asset_filename=filename,
                        input_asset_sha256=asset_sha256,
                    )
                    return result, infer_time

                try:
                    result, infer_time_ms = await asyncio.wait_for(
                        _execute_inference(),
                        timeout=timeout_seconds,
                    )
                    scheduler_queue.mark_completed(task.task_id, runtime_ms=infer_time_ms)
                except asyncio.TimeoutError:
                    scheduler_queue.mark_failed(
                        task.task_id,
                        error=f"Inference execution timed out after {timeout_seconds}s",
                        is_timeout=True,
                    )
                    scheduler_events.log_event(
                        stage="ERROR",
                        status="error",
                        message=f"Inference timed out after {timeout_seconds}s.",
                        model_id=model_id,
                        capability_id=capability_id,
                        case_id=case_id,
                        error_code="INFERENCE_TIMEOUT",
                    )
                    raise TimeoutError(f"Inference for '{capability_id}' exceeded timeout limit of {timeout_seconds}s")
                except Exception as e:
                    scheduler_queue.mark_failed(task.task_id, error=str(e))
                    scheduler_events.log_event(
                        stage="ERROR",
                        status="error",
                        message=f"Inference failed with error: {str(e)}",
                        model_id=model_id,
                        capability_id=capability_id,
                        case_id=case_id,
                        error_code="INFERENCE_FAILURE",
                    )
                    raise

        scheduler_events.log_event(
            stage="INFER",
            status="success",
            message=f"Inference executed successfully in {infer_time_ms:.1f} ms.",
            model_id=model_id,
            capability_id=capability_id,
            case_id=case_id,
            inference_time_ms=infer_time_ms,
            memory_mb=estimated_ram_mb,
        )

        # =====================================================================
        # STAGE 5: PERSIST
        # =====================================================================
        scheduler_events.log_event(
            stage="PERSIST",
            status="success",
            message=f"Normalized findings generated for asset '{filename or asset_id}'.",
            model_id=model_id,
            capability_id=capability_id,
            case_id=case_id,
            metadata={"findings_count": len(result.findings)},
        )

        # =====================================================================
        # STAGE 6: CACHE / UNLOAD
        # =====================================================================
        # Model is kept resident in LRU cache according to policy
        scheduler_events.log_event(
            stage="CACHE",
            status="info",
            message=f"Model '{model_id}' retained in resident LRU cache.",
            model_id=model_id,
            capability_id=capability_id,
            case_id=case_id,
        )

        return result

    def get_dashboard_data(self) -> Dict[str, Any]:
        """Aggregate telemetry, loaded models, memory estimates, queue, and recent events."""
        telemetry = get_hardware_telemetry()
        cache_metrics = model_cache.get_metrics()
        queue_status = scheduler_queue.get_queue_status()
        recent_events = scheduler_events.get_recent_events(limit=40)

        # Memory estimates across the six capabilities
        estimates: List[Dict[str, Any]] = []
        for cap in adapter_registry.list_capabilities():
            estimates.append({
                "capability_id": cap["capability_id"],
                "name": cap["name"],
                "expected_modality": cap["expected_modality"],
                "estimated_ram_mb": cap.get("estimated_ram_mb", 512),
                "estimated_vram_mb": cap.get("estimated_vram_mb", 0),
                "expected_latency_ms": cap.get("expected_latency_ms", 500),
                "status": cap["status"],
            })

        return {
            "telemetry": telemetry.to_dict(),
            "simulation": {
                "active": simulated_config.enabled,
                "label": simulated_config.label,
                "simulated_max_ram_mb": simulated_config.simulated_max_ram_mb,
                "simulated_max_vram_mb": simulated_config.simulated_max_vram_mb,
                "description": simulated_config.description,
            },
            "cache": cache_metrics,
            "memory_estimates": estimates,
            "queue": queue_status,
            "recent_events": recent_events,
        }

    def unload_model(self, capability_id: str) -> bool:
        """Explicitly evict and unload a model from memory."""
        success = model_cache.evict(capability_id)
        if success:
            scheduler_events.log_event(
                stage="UNLOAD",
                status="info",
                message=f"Manual eviction of model for capability '{capability_id}'.",
                capability_id=capability_id,
            )
        return success

    def unload_all(self) -> int:
        """Explicitly evict all models from memory."""
        count = model_cache.evict_all()
        scheduler_events.log_event(
            stage="UNLOAD",
            status="info",
            message=f"Manual eviction of all resident models ({count} models unloaded).",
        )
        return count

    def set_simulation_mode(
        self,
        enabled: bool,
        max_ram_mb: Optional[int] = None,
        max_vram_mb: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Configure optional simulated constrained-resource mode."""
        simulated_config.enabled = enabled
        if max_ram_mb is not None:
            simulated_config.simulated_max_ram_mb = max_ram_mb
        if max_vram_mb is not None:
            simulated_config.simulated_max_vram_mb = max_vram_mb

        scheduler_events.log_event(
            stage="RESOURCE_CHECK",
            status="warning" if enabled else "info",
            message=(
                f"Simulated Constrained-Resource Mode {'ENABLED' if enabled else 'DISABLED'}. "
                f"Limit: {simulated_config.simulated_max_ram_mb} MB RAM. "
                f"Label: {simulated_config.label}."
            ),
            is_simulated=enabled,
        )
        return simulated_config.to_dict()


# Global scheduler singleton
resource_scheduler = ResourceAwareScheduler()
