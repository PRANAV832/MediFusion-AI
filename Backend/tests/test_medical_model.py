import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.manager import model_manager
from app.models.base import MedicalModel
from app.models.chest_xray import ChestXRayDenseNetModel
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


def test_medical_model_status_endpoint():
    """Verify GET /api/v1/models/status returns READY with real configuration."""
    response = client.get("/api/v1/models/status?model_id=torchxrayvision-densenet121")
    assert response.status_code == 200
    data = response.json()
    assert data["model_id"] == "torchxrayvision-densenet121"
    assert data["capability"] == "chest_xray_screening"
    assert data["status"] in ("READY", "NOT_CONFIGURED", "MODEL_UNAVAILABLE", "ERROR")
    assert data["status"] == "READY"
    assert data["dependencies_installed"] is True
    assert data["weights_available"] is True
    assert len(data["pathologies"]) == 18
    assert "Pneumonia" in data["pathologies"]
    assert "Cardiomegaly" in data["pathologies"]
    assert len(data["limitations"]) > 0


def test_medical_model_unconfigured_status():
    """Verify requesting an unknown model returns NOT_CONFIGURED."""
    response = client.get("/api/v1/models/status?model_id=unknown-brain-mri-model")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "NOT_CONFIGURED"


def test_medical_model_adapter_unit():
    """Verify ChestXRayDenseNetModel conforms to MedicalModel interface with real inference."""
    model = ChestXRayDenseNetModel()
    assert isinstance(model, MedicalModel)
    assert model.model_id == "torchxrayvision-densenet121"
    assert model.capability == "chest_xray_screening"

    model.load()
    assert model.is_loaded is True

    # Load test fixture
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "sample_chest_xray.jpg")
    with open(fixture_path, "rb") as f:
        image_bytes = f.read()

    preprocessed = model.preprocess(image_bytes)
    assert preprocessed.shape == (1, 1, 224, 224)

    raw_preds = model.predict(preprocessed)
    assert raw_preds.shape == (1, 18)

    normalized = model.postprocess(
        raw_predictions=raw_preds,
        input_asset_id="asset-unit-test-1",
        runtime_ms=125.5,
        input_asset_filename="sample_chest_xray.jpg",
    )

    # Validate required normalized result fields
    assert normalized.model_id == "torchxrayvision-densenet121"
    assert normalized.model_version == "densenet121-res224-all"
    assert normalized.capability == "chest_xray_screening"
    assert normalized.input_asset_id == "asset-unit-test-1"
    assert len(normalized.findings) == 18
    assert len(normalized.scores) == 18
    assert normalized.runtime_ms == 125.5
    assert normalized.device in ("cpu", "cuda")
    assert normalized.provenance.model_name == "TorchXRayVision DenseNet-121"
    assert normalized.provenance.architecture == "DenseNet-121 (densenet121-res224-all)"
    assert len(normalized.limitations) > 0


def test_model_run_persistence_and_retrieval():
    """Test creating a case, uploading real X-ray, running model, and listing persisted runs."""
    # 1. Fetch existing patient
    patients_res = client.get("/api/v1/patients/?limit=1")
    assert patients_res.status_code == 200
    patients = patients_res.json()
    if not patients:
        pytest.skip("No patients available in database.")
    patient_id = patients[0]["id"]

    # 2. Create clinical case
    case_payload = {
        "patient_id": patient_id,
        "title": "Phase 4 Automated Model Test Case",
        "chief_complaint": "Persistent cough and shortness of breath",
        "symptoms": ["cough", "dyspnea"],
        "clinical_notes": "Chest X-Ray evaluation for pneumonia or infiltration",
        "priority": "urgent",
    }
    case_res = client.post("/api/v1/cases/", json=case_payload)
    assert case_res.status_code == 201
    case_data = case_res.json()
    case_id = case_data["id"]

    # 3. Upload real chest X-ray image fixture
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "sample_chest_xray.jpg")
    with open(fixture_path, "rb") as f:
        file_content = f.read()

    upload_res = client.post(
        f"/api/v1/cases/{case_id}/assets",
        data={"modality": "chest_xray"},
        files={"file": ("clinical_radiograph.jpg", file_content, "image/jpeg")},
    )
    assert upload_res.status_code == 201
    asset_data = upload_res.json()
    asset_id = asset_data["id"]

    # 4. Execute specialized model inference
    run_res = client.post(
        f"/api/v1/models/cases/{case_id}/run",
        json={"asset_id": asset_id},
    )
    assert run_res.status_code == 201
    run_data = run_res.json()

    assert run_data["case_id"] == case_id
    assert run_data["asset_id"] == asset_id
    assert run_data["model_id"] == "torchxrayvision-densenet121"
    assert run_data["status"] == "completed"
    assert len(run_data["findings"]) == 18
    assert len(run_data["scores"]) == 18
    assert run_data["runtime_ms"] > 0
    assert run_data["provenance"]["architecture"] == "DenseNet-121 (densenet121-res224-all)"

    # 5. Retrieve runs for case
    list_res = client.get(f"/api/v1/models/cases/{case_id}/runs")
    assert list_res.status_code == 200
    runs = list_res.json()
    assert len(runs) >= 1
    assert any(r["id"] == run_data["id"] for r in runs)
