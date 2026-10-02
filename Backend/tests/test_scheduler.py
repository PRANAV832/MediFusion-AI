"""Automated tests for Phase 8 Resource-Aware Scheduler."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.exceptions import ModelResourceUnavailableException
from app.core.security import AuthenticatedUser, get_current_user
from app.scheduler.state import (
    get_hardware_telemetry,
    evaluate_resource_availability,
    simulated_config,
)
from app.scheduler.cache import ModelCacheManager
from app.scheduler.events import SchedulerEventManager
from app.scheduler.queue import ConcurrencyQueueManager
from app.scheduler.manager import resource_scheduler
from app.models.base import MedicalModel


class DummyTestModel(MedicalModel):
    def __init__(self, model_id="dummy-test-model"):
        super().__init__(
            model_id=model_id,
            model_version="v1.0",
            capability="test_capability",
            device="cpu",
        )
        self.unloaded = False

    def load(self):
        self._is_loaded = True
        self.unloaded = False

    def unload(self):
        self._is_loaded = False
        self.unloaded = True

    def preprocess(self, input_data, **kwargs):
        return input_data

    def predict(self, preprocessed_data):
        return [0.9]

    def postprocess(self, raw_predictions, **kwargs):
        return raw_predictions

    def get_limitations(self):
        return ["Test model only"]

    def get_output_schema(self):
        return {"targets": ["test_finding"]}

    def get_preprocessing_contract(self):
        return {"supported_formats": [".png", ".dat"]}

    def verify(self):
        return {"verified": True, "status": "READY", "failure_reasons": []}


@pytest.fixture
def auth_client():
    mock_user = AuthenticatedUser(
        user_id="00000000-0000-0000-0000-000000000001",
        email="scheduler_tester@medifusion.ai",
        profile={"id": "00000000-0000-0000-0000-000000000001", "role": "clinician", "full_name": "Dr. Scheduler Tester"},
        token="mock_token",
    )
    app.dependency_overrides[get_current_user] = lambda: mock_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_current_user, None)


def test_hardware_telemetry():
    """Verify physical hardware telemetry inspection."""
    telemetry = get_hardware_telemetry()
    assert telemetry.total_ram_mb > 0
    assert telemetry.available_ram_mb > 0
    assert telemetry.cpu_cores >= 1
    assert isinstance(telemetry.ram_usage_percent, float)
    assert isinstance(telemetry.cuda_available, bool)


def test_simulated_constrained_resource_mode():
    """Verify optional simulated constrained-resource mode explicitly declares SIMULATED_RESOURCE_LIMIT."""
    # Reset simulation state
    simulated_config.enabled = False

    # 1. Real check should pass for normal 512MB model
    avail, msg, is_sim, code = evaluate_resource_availability(required_ram_mb=512)
    assert avail is True
    assert is_sim is False

    # 2. Enable simulated constrained limit of 256MB
    simulated_config.enabled = True
    simulated_config.simulated_max_ram_mb = 256

    # 3. Model requiring 512MB must be rejected under simulation
    avail_sim, msg_sim, is_sim, code = evaluate_resource_availability(required_ram_mb=512)
    assert avail_sim is False
    assert is_sim is True
    assert code == "MODEL_RESOURCE_UNAVAILABLE"
    assert "SIMULATED_RESOURCE_LIMIT" in msg_sim
    assert "exceeds the simulated maximum allocation of 256 MB" in msg_sim

    # 4. Clean reset
    simulated_config.enabled = False


def test_model_cache_lru_lifecycle():
    """Verify resident model caching, hit/miss metrics, and LRU memory eviction."""
    cache = ModelCacheManager(max_resident_models=2, max_resident_ram_mb=1024)

    m1 = DummyTestModel("model-1")
    m2 = DummyTestModel("model-2")
    m3 = DummyTestModel("model-3")

    # Miss then put
    assert cache.get("cap-1") is None
    assert cache.misses == 1

    evicted = cache.put("cap-1", m1, load_time_ms=100.0, estimated_ram_mb=400)
    assert evicted == []
    assert cache.total_resident_ram_mb == 400

    # Hit
    cached_m1 = cache.get("cap-1")
    assert cached_m1 is m1
    assert cache.hits == 1

    # Put second model
    cache.put("cap-2", m2, load_time_ms=120.0, estimated_ram_mb=400)
    assert len(cache._entries) == 2

    # Access cap-1 again so cap-2 becomes the least recently used
    assert cache.get("cap-1") is m1

    # Put third model: exceeds max_resident_models=2, so least recently used (cap-2) gets evicted
    evicted_caps = cache.put("cap-3", m3, load_time_ms=80.0, estimated_ram_mb=400)
    assert len(evicted_caps) == 1
    assert evicted_caps[0] == "cap-2"
    assert m2.unloaded is True

    # Evict all
    unloaded_count = cache.evict_all()
    assert unloaded_count == 2
    assert cache.total_resident_ram_mb == 0


def test_concurrency_queue_manager():
    """Verify task registration and state transitions in queue manager."""
    queue = ConcurrencyQueueManager(max_concurrency=2, default_timeout_seconds=5.0)

    task = queue.register_task(capability_id="test_cap", model_id="test_model", case_id="case-123")
    assert task.status == "queued"
    assert queue.get_queue_status()["active_tasks_count"] == 1

    queue.mark_running(task.task_id)
    assert task.status == "running"

    queue.mark_completed(task.task_id, runtime_ms=150.0)
    assert queue.get_queue_status()["active_tasks_count"] == 0
    assert queue.total_completed == 1


@pytest.mark.asyncio
async def test_insufficient_resources_protection():
    """Verify scheduler raises ModelResourceUnavailableException when resources are constrained."""
    # Enable simulation with extreme constraint
    resource_scheduler.set_simulation_mode(enabled=True, max_ram_mb=64)

    try:
        with pytest.raises(ModelResourceUnavailableException) as exc_info:
            await resource_scheduler.schedule_and_run(
                capability_id="pneumonia_screening",
                asset_bytes=b"dummy_bytes",
                asset_id="asset-test",
            )
        assert exc_info.value.details.get("error_code") == "MODEL_RESOURCE_UNAVAILABLE"
        assert "SIMULATED_RESOURCE_LIMIT" in str(exc_info.value.message)
    finally:
        resource_scheduler.set_simulation_mode(enabled=False)


def test_scheduler_api_endpoints(auth_client: TestClient):
    """Verify RESTful API endpoints for scheduler dashboard, simulation controls, and events."""
    # 1. Test Dashboard endpoint
    dash_resp = auth_client.get("/api/v1/scheduler/dashboard")
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert "telemetry" in dash_data
    assert "cache" in dash_data
    assert "queue" in dash_data
    assert "memory_estimates" in dash_data
    assert len(dash_data["memory_estimates"]) == 6

    # 2. Test Simulated Limits configuration
    sim_resp = auth_client.post(
        "/api/v1/scheduler/simulated-limits",
        json={"enabled": True, "max_ram_mb": 512, "max_vram_mb": 0},
    )
    assert sim_resp.status_code == 200
    sim_data = sim_resp.json()
    assert sim_data["enabled"] is True
    assert sim_data["simulated_max_ram_mb"] == 512
    assert sim_data["label"] == "SIMULATED_RESOURCE_LIMIT"

    # Turn off simulation
    reset_resp = auth_client.post(
        "/api/v1/scheduler/simulated-limits",
        json={"enabled": False},
    )
    assert reset_resp.status_code == 200
    assert reset_resp.json()["enabled"] is False

    # 3. Test Unload-All endpoint
    unload_resp = auth_client.post("/api/v1/scheduler/unload-all")
    assert unload_resp.status_code == 200
    assert unload_resp.json()["success"] is True

    # 4. Test Events endpoint
    events_resp = auth_client.get("/api/v1/scheduler/events?limit=10")
    assert events_resp.status_code == 200
    assert isinstance(events_resp.json(), list)
