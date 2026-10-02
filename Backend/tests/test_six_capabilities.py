import io
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.models.registry import adapter_registry
from app.models.manager import model_manager
from app.core.security import get_current_user, AuthenticatedUser

test_user_id = "00000000-0000-0000-0000-000000000001"
MOCK_USER = AuthenticatedUser(
    user_id=test_user_id,
    email="dr.chen@medifusion.ai",
    profile={
        "id": test_user_id,
        "email": "dr.chen@medifusion.ai",
        "full_name": "Dr. Sarah Chen, MD",
        "role": "radiologist",
        "department": "Pulmonary Imaging",
    },
    token="mock_jwt_token",
)


@pytest.fixture
def auth_client():
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_current_user, None)



def test_six_capabilities_discovery_and_metadata():
    """Verify that all six capabilities are discovered with all 10 mandatory fields."""
    caps = adapter_registry.list_capabilities()
    assert len(caps) >= 6

    cap_map = {c["capability_id"]: c for c in caps}

    expected_six = [
        ("brain_tumor_screening", "mri", "BrainTumorMRIAdapter", "not_configured"),
        ("brain_stroke_abnormality_screening", "ct", "BrainStrokeCTAdapter", "not_configured"),
        ("arrhythmia_cardiac_abnormality_screening", "ecg", "ECGArrhythmiaAdapter", "not_configured"),
        ("pneumonia_screening", "chest_xray", "PneumoniaChestXRayAdapter", "ready"),
        ("lung_opacity_abnormality_screening", "chest_xray", "LungOpacityChestXRayAdapter", "ready"),
        ("skin_lesion_screening", "skin_image", "SkinLesionAdapter", "not_configured"),
    ]

    mandatory_fields = [
        "capability_id",
        "expected_modality",
        "adapter_class",
        "preprocessing_contract",
        "output_schema",
        "model_source",
        "provenance",
        "limitations",
        "license",
        "status",
    ]

    for cap_id, modality, adapter_class, expected_status in expected_six:
        assert cap_id in cap_map, f"Missing capability: {cap_id}"
        entry = cap_map[cap_id]

        # Check all 10 fields exist and are non-empty
        for field in mandatory_fields:
            assert field in entry, f"Missing field '{field}' in {cap_id}"
            assert entry[field] is not None, f"Field '{field}' is None in {cap_id}"

        assert entry["expected_modality"] == modality
        assert entry["adapter_class"] == adapter_class
        assert entry["status"] == expected_status
        assert len(entry["limitations"]) > 0
        assert len(entry["preprocessing_contract"]) > 0
        assert len(entry["output_schema"]) > 0


def test_nine_criteria_model_verification():
    """Verify the 9-point verification check for configured vs unconfigured candidates."""
    # 1. Pneumonia (Ready)
    pneu_health = adapter_registry.check_health("pneumonia_screening")
    assert pneu_health["status"] == "READY"
    assert pneu_health["runtime_ready"] is True
    assert pneu_health["weights_present"] is True
    assert pneu_health["dependencies_ready"] is True
    checklist = pneu_health["verification_details"]["checklist"]
    assert len(checklist) == 9
    for crit in ["license", "input", "preprocessing", "labels", "outputs", "weights", "dependencies", "limitations", "hardware_requirements"]:
        assert crit in checklist
        assert checklist[crit]["verified"] is True

    # 2. Brain tumor MRI (Candidate verification fails -> NOT_CONFIGURED)
    brain_health = adapter_registry.check_health("brain_tumor_screening")
    assert brain_health["status"] == "NOT_CONFIGURED"
    assert brain_health["runtime_ready"] is False
    assert len(brain_health["verification_details"]["failure_reasons"]) > 0

    # 3. Brain stroke CT (Candidate verification fails -> NOT_CONFIGURED)
    stroke_health = adapter_registry.check_health("brain_stroke_abnormality_screening")
    assert stroke_health["status"] == "NOT_CONFIGURED"
    assert stroke_health["runtime_ready"] is False

    # 4. ECG Arrhythmia (Candidate verification fails -> NOT_CONFIGURED)
    ecg_health = adapter_registry.check_health("arrhythmia_cardiac_abnormality_screening")
    assert ecg_health["status"] == "NOT_CONFIGURED"
    assert ecg_health["runtime_ready"] is False

    # 5. Skin lesion (Candidate verification fails -> NOT_CONFIGURED)
    skin_health = adapter_registry.check_health("skin_lesion_screening")
    assert skin_health["status"] == "NOT_CONFIGURED"
    assert skin_health["runtime_ready"] is False


def test_unconfigured_adapters_forbid_fake_predictions():
    """Unconfigured adapters must strictly raise RuntimeError and never produce fake predictions."""
    brain_adapter = adapter_registry.get_adapter("brain_tumor_screening")
    assert brain_adapter is not None
    with pytest.raises(RuntimeError) as exc_info:
        brain_adapter.predict(b"fake_data")
    assert "NOT_CONFIGURED" in str(exc_info.value)
    assert "strictly prohibited" in str(exc_info.value)

    stroke_adapter = adapter_registry.get_adapter("brain_stroke_abnormality_screening")
    with pytest.raises(RuntimeError):
        stroke_adapter.predict(b"fake_data")

    ecg_adapter = adapter_registry.get_adapter("arrhythmia_cardiac_abnormality_screening")
    with pytest.raises(RuntimeError):
        ecg_adapter.predict(b"fake_data")

    skin_adapter = adapter_registry.get_adapter("skin_lesion_screening")
    with pytest.raises(RuntimeError):
        skin_adapter.predict(b"fake_data")


def test_capability_resolver():
    """Verify that capability resolver returns runnable capabilities for compatible modalities."""
    # Chest X-ray runnable resolver
    cxr_runnable = adapter_registry.resolve_capabilities("chest_xray", runnable_only=True)
    cxr_ids = [c["capability_id"] for c in cxr_runnable]
    assert "pneumonia_screening" in cxr_ids
    assert "lung_opacity_abnormality_screening" in cxr_ids

    # MRI runnable resolver (should be empty since BraTS is unconfigured)
    mri_runnable = adapter_registry.resolve_capabilities("mri", runnable_only=True)
    assert len(mri_runnable) == 0

    # MRI all resolver
    mri_all = adapter_registry.resolve_capabilities("mri", runnable_only=False)
    mri_ids = [c["capability_id"] for c in mri_all]
    assert "brain_tumor_screening" in mri_ids
    assert all(c["status"] == "not_configured" for c in mri_all)

    # ECG resolver
    ecg_all = adapter_registry.resolve_capabilities("ecg", runnable_only=False)
    assert len(ecg_all) == 1
    assert ecg_all[0]["capability_id"] == "arrhythmia_cardiac_abnormality_screening"
    assert ecg_all[0]["status"] == "not_configured"


def test_capabilities_api_endpoints(auth_client):
    """Verify HTTP API endpoints for capabilities catalog and resolution."""
    # List capabilities
    res = auth_client.get("/api/v1/capabilities")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 6

    # Test filtering by runnable_only
    runnable_res = auth_client.get("/api/v1/capabilities?runnable_only=true")
    assert runnable_res.status_code == 200
    runnable_data = runnable_res.json()
    assert all(item["status"] == "ready" for item in runnable_data)
    assert len(runnable_data) >= 2

    # Test resolver endpoint
    resolve_res = auth_client.get("/api/v1/capabilities/resolve?modality=chest_xray&runnable_only=true")
    assert resolve_res.status_code == 200
    resolve_data = resolve_res.json()
    assert resolve_data["modality"] == "chest_xray"
    assert resolve_data["count"] >= 2
    assert resolve_data["runnable_only"] is True

    # Test single capability detail
    detail_res = auth_client.get("/api/v1/capabilities/pneumonia_screening")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["capability_id"] == "pneumonia_screening"
    assert detail["status"] == "ready"
    assert "verification_details" in detail

    # Test health endpoint
    health_res = auth_client.get("/api/v1/capabilities/pneumonia_screening/health")
    assert health_res.status_code == 200
    health = health_res.json()
    assert health["status"] == "READY"
    assert health["runtime_ready"] is True

