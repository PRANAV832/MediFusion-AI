import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_user, AuthenticatedUser

client = TestClient(app)

test_user_id = "00000000-0000-0000-0000-000000000001"
MOCK_CLINICIAN = AuthenticatedUser(
    user_id=test_user_id,
    email="clinician.lead@medifusion.org",
    profile={
        "id": test_user_id,
        "email": "clinician.lead@medifusion.org",
        "full_name": "Dr. Lead Clinician",
        "role": "clinician",
        "organization": "MediFusion Medical Center",
    },
    token="mock_jwt_token",
)


@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[get_current_user] = lambda: MOCK_CLINICIAN
    yield
    app.dependency_overrides.pop(get_current_user, None)


def test_list_registry_models():
    """Verify GET /api/v1/registry/models returns seeded models with all metadata."""
    res = client.get("/api/v1/registry/models")
    assert res.status_code == 200
    models = res.json()
    assert len(models) >= 5

    # Check that TorchXRayVision DenseNet-121 is present and ready
    cxr = next((m for m in models if m["id"] == "torchxrayvision-densenet121"), None)
    assert cxr is not None
    assert cxr["modality"] == "chest_xray"
    assert cxr["domain"] == "pulmonology"
    assert cxr["runtime_status"] == "ready"
    assert cxr["parameter_count"] > 0
    assert cxr["license"] is not None
    assert cxr["checksum"] is not None
    assert len(cxr["capabilities"]) >= 1
    assert len(cxr["limitations"]) >= 1


def test_filter_registry_models():
    """Verify modality, domain, and status filtering on registry models list."""
    res = client.get("/api/v1/registry/models?modality=chest_xray")
    assert res.status_code == 200
    models = res.json()
    assert all(m["modality"] == "chest_xray" for m in models)

    res_cardio = client.get("/api/v1/registry/models?domain=cardiology")
    assert res_cardio.status_code == 200
    cardio_models = res_cardio.json()
    assert any(m["id"] == "ecg-arrhythmia-ptbxl" for m in cardio_models)


def test_get_registry_model_detail():
    """Verify GET /api/v1/registry/models/{model_id} returns complete model profile."""
    res = client.get("/api/v1/registry/models/torchxrayvision-densenet121")
    assert res.status_code == 200
    model = res.json()

    # Validate all 18 required stored attributes
    assert model["id"] == "torchxrayvision-densenet121"
    assert model["name"] is not None
    assert model["version"] == "densenet121-res224-all"
    assert model["domain"] == "pulmonology"
    assert model["modality"] == "chest_xray"
    assert "chest_xray_screening" in model["capabilities"]
    assert model["framework"] == "torchxrayvision"
    assert model["artifact_source"].startswith("http")
    assert model["parameter_count"] == 7035922
    assert model["estimated_ram_mb"] == 512
    assert model["estimated_vram_mb"] == 1024
    assert model["expected_latency_ms"] == 350
    assert "cpu" in model["device_support"]
    assert model["status"] == "ready"
    assert "training_datasets" in model["provenance"]
    assert len(model["limitations"]) > 0
    assert model["license"] is not None
    assert model["checksum"] is not None


def test_model_compatibility_endpoint():
    """Verify dynamic model resolution without hard-coding."""
    res = client.get("/api/v1/registry/compatibility?modality=chest_xray")
    assert res.status_code == 200
    data = res.json()
    assert data["modality"] == "chest_xray"
    assert data["count"] >= 1
    assert any(m["id"] == "torchxrayvision-densenet121" for m in data["compatible_models"])

    # Test non-existent modality
    res_none = client.get("/api/v1/registry/compatibility?modality=non_existent_modality")
    assert res_none.status_code == 200
    assert res_none.json()["count"] == 0


def test_model_health_endpoint():
    """Verify dynamic health and runtime dependency verification."""
    # Active model
    res = client.get("/api/v1/registry/models/torchxrayvision-densenet121/health")
    assert res.status_code == 200
    health = res.json()
    assert health["model_id"] == "torchxrayvision-densenet121"
    assert health["status"] == "READY"
    assert health["runtime_ready"] is True
    assert health["weights_present"] is True
    assert health["dependencies_ready"] is True

    # Unconfigured model
    res_unconf = client.get("/api/v1/registry/models/brain-tumor-mri-seg/health")
    assert res_unconf.status_code == 200
    health_unconf = res_unconf.json()
    assert health_unconf["model_id"] == "brain-tumor-mri-seg"
    assert health_unconf["runtime_ready"] is False
    assert health_unconf["status"] == "not_configured"


def test_register_and_update_model():
    """Verify registering a new model and updating its configuration in database."""
    unique_slug = f"test-model-{uuid.uuid4().hex[:8]}"
    register_payload = {
        "id": unique_slug,
        "name": "Experimental Ultrasound EchoNet",
        "version": "v0.1.0-alpha",
        "domain": "cardiology",
        "modality": "echocardiogram",
        "capabilities": ["ejection_fraction_estimation"],
        "framework": "pytorch",
        "artifact_source": "https://example.com/echonet.pt",
        "parameter_count": 12500000,
        "estimated_ram_mb": 1024,
        "estimated_vram_mb": 2048,
        "expected_latency_ms": 400,
        "device_support": ["cpu", "cuda"],
        "status": "not_configured",
        "provenance": {"author": "EchoNet Research Team"},
        "limitations": ["Pre-clinical validation only."],
        "license": "MIT",
        "checksum": "abc123sha256",
        "metadata": {"apical_4_chamber": True},
    }

    # Register
    res_reg = client.post("/api/v1/registry/models", json=register_payload)
    assert res_reg.status_code == 201
    created = res_reg.json()
    assert created["id"] == unique_slug
    assert created["name"] == "Experimental Ultrasound EchoNet"

    # Update
    update_payload = {
        "status": "active",
        "expected_latency_ms": 320,
    }
    res_up = client.patch(f"/api/v1/registry/models/{unique_slug}", json=update_payload)
    assert res_up.status_code == 200
    updated = res_up.json()
    assert updated["status"] == "active"
    assert updated["expected_latency_ms"] == 320
