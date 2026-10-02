import io
import uuid
import pytest
from app.core.security import AuthenticatedUser, get_current_user
from app.core.supabase import get_supabase_admin_client
from app.main import app


@pytest.fixture(scope="module")
def setup_patient_and_case(client):
    """Create a temporary test patient and clinical case for multimodal intake tests."""
    admin_client = get_supabase_admin_client()
    unique_id = uuid.uuid4().hex[:6]

    test_user_id = str(uuid.uuid4())
    test_user = AuthenticatedUser(
        user_id=test_user_id,
        email="dr.intake@medifusion.health",
        profile={
            "id": test_user_id,
            "email": "dr.intake@medifusion.health",
            "full_name": "Dr. Marcus Vance",
            "role": "clinician",
            "organization": "MediFusion Medical Center",
        },
        token="mock_jwt_token",
    )
    app.dependency_overrides[get_current_user] = lambda: test_user

    # Create test patient
    p_data = {
        "mrn": f"MRN-INTAKE-{unique_id}",
        "first_name": "Marcus",
        "last_name": "Vance",
        "date_of_birth": "1975-08-20",
        "gender": "Male",
        "blood_type": "O+",
        "allergies": ["Aspirin"],
        "chronic_conditions": ["Hypertension"],
    }
    p_res = admin_client.table("patients").insert(p_data).execute()
    assert p_res.data, "Failed to create fixture patient"
    patient = p_res.data[0]

    # Create test case
    case_payload = {
        "patient_id": patient["id"],
        "title": "Cardiopulmonary Workup",
        "chief_complaint": "Acute onset of exertional dyspnea and atypical chest discomfort",
        "symptoms": ["Shortness of breath", "Substernal tightness", "Fatigue"],
        "clinical_notes": "Patient presents with progressive exertional chest pressure for 3 days. Baseline ECG ordered along with PA chest radiograph and basic metabolic panel.",
        "priority": "urgent",
    }
    c_res = client.post("/api/v1/cases/", json=case_payload)
    assert c_res.status_code == 201, f"Failed to create fixture case: {c_res.text}"
    case = c_res.json()

    yield {"patient": patient, "case": case}

    # Teardown
    admin_client.table("medical_assets").delete().eq("case_id", case["id"]).execute()
    admin_client.table("clinical_events").delete().eq("case_id", case["id"]).execute()
    admin_client.table("patient_cases").delete().eq("id", case["id"]).execute()
    admin_client.table("patients").delete().eq("id", patient["id"]).execute()
    app.dependency_overrides.pop(get_current_user, None)


def test_multimodal_intake_validation_errors(client, setup_patient_and_case):
    """Test validation guards on asset uploads: invalid modality, empty file, non-existent case."""
    case_id = setup_patient_and_case["case"]["id"]

    # 1. Invalid modality
    fake_file = io.BytesIO(b"some content")
    resp = client.post(
        f"/api/v1/cases/{case_id}/assets",
        files={"file": ("test.png", fake_file, "image/png")},
        data={"modality": "unknown_modality"},
    )
    assert resp.status_code == 422, f"Expected 422 for invalid modality, got {resp.status_code}"

    # 2. Empty file
    empty_file = io.BytesIO(b"")
    resp_empty = client.post(
        f"/api/v1/cases/{case_id}/assets",
        files={"file": ("empty.png", empty_file, "image/png")},
        data={"modality": "chest_xray"},
    )
    assert resp_empty.status_code == 400

    # 3. Non-existent case
    fake_case_id = str(uuid.uuid4())
    dummy_file = io.BytesIO(b"some image bytes")
    resp_case = client.post(
        f"/api/v1/cases/{fake_case_id}/assets",
        files={"file": ("xray.png", dummy_file, "image/png")},
        data={"modality": "chest_xray"},
    )
    assert resp_case.status_code == 404


def test_multimodal_intake_full_case_assets(client, setup_patient_and_case):
    """
    Test uploading all 4 required assets to the case:
    1. Chest X-ray
    2. ECG
    3. PDF report
    4. Clinical notes
    """
    admin_client = get_supabase_admin_client()
    case_id = setup_patient_and_case["case"]["id"]
    patient_id = setup_patient_and_case["patient"]["id"]

    # 1. Upload Chest X-Ray
    xray_bytes = io.BytesIO(b"\x89PNG\r\n\x1a\nFakeChestXRayImageBytesData1234567890")
    resp_xray = client.post(
        f"/api/v1/cases/{case_id}/assets",
        files={"file": ("chest_xray_pa.png", xray_bytes, "image/png")},
        data={
            "modality": "chest_xray",
            "clinical_context": "Posterior-anterior view, upright, full inspiration.",
        },
    )
    assert resp_xray.status_code == 201, f"Chest X-Ray upload failed: {resp_xray.text}"
    xray_asset = resp_xray.json()
    assert xray_asset["modality"] == "chest_xray"
    assert xray_asset["patient_id"] == patient_id
    assert xray_asset["case_id"] == case_id
    assert "checksum_sha256" in xray_asset["metadata"]
    assert xray_asset["signed_url"] is not None

    # 2. Upload ECG File (CSV signal data)
    ecg_csv = b"time_ms,lead_I,lead_II,lead_V1\n0,0.12,0.45,0.02\n10,0.15,0.60,0.04\n20,0.10,0.30,0.01"
    resp_ecg = client.post(
        f"/api/v1/cases/{case_id}/assets",
        files={"file": ("12_lead_rhythm_strip.csv", io.BytesIO(ecg_csv), "text/csv")},
        data={
            "modality": "ecg",
            "clinical_context": "Standard 12-lead rhythm strip, sinus rhythm with occasional PACs.",
        },
    )
    assert resp_ecg.status_code == 201, f"ECG upload failed: {resp_ecg.text}"
    ecg_asset = resp_ecg.json()
    assert ecg_asset["modality"] == "ecg"
    assert ecg_asset["metadata"]["checksum_sha256"] is not None

    # 3. Upload PDF Lab Report
    pdf_bytes = b"%PDF-1.4 Fake Lab Report Metabolic Panel and Troponin T <0.01 ng/mL %%EOF"
    resp_pdf = client.post(
        f"/api/v1/cases/{case_id}/assets",
        files={"file": ("comprehensive_metabolic_panel.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        data={
            "modality": "pdf_report",
            "clinical_context": "Stat lab results: normal troponin, mildly elevated glucose (138 mg/dL).",
        },
    )
    assert resp_pdf.status_code == 201, f"PDF upload failed: {resp_pdf.text}"
    pdf_asset = resp_pdf.json()
    assert pdf_asset["modality"] == "pdf_report"

    # 4. Upload Clinical Notes
    notes_bytes = b"PHYSICIAN INTAKE NOTE:\nPatient examined in ED bay 3. Alert and oriented x3.\nCardiovascular: Normal S1/S2, regular rate.\nRespiratory: Clear to auscultation bilaterally, no crackles or wheezing."
    resp_notes = client.post(
        f"/api/v1/cases/{case_id}/assets",
        files={"file": ("ed_attending_note.txt", io.BytesIO(notes_bytes), "text/plain")},
        data={
            "modality": "clinical_note",
            "clinical_context": "Emergency department attending clinical encounter documentation.",
        },
    )
    assert resp_notes.status_code == 201, f"Clinical note upload failed: {resp_notes.text}"
    notes_asset = resp_notes.json()
    assert notes_asset["modality"] == "clinical_note"

    # 5. List assets in case workspace
    list_resp = client.get(f"/api/v1/cases/{case_id}/assets")
    assert list_resp.status_code == 200
    assets = list_resp.json()
    assert len(assets) == 4
    modalities = {a["modality"] for a in assets}
    assert modalities == {"chest_xray", "ecg", "pdf_report", "clinical_note"}

    # 6. Verify signed URL retrieval endpoint
    url_resp = client.get(f"/api/v1/cases/{case_id}/assets/{xray_asset['id']}/url")
    assert url_resp.status_code == 200
    assert "signed_url" in url_resp.json()

    # 7. Delete one asset and verify list decrements
    del_resp = client.delete(f"/api/v1/cases/{case_id}/assets/{notes_asset['id']}")
    assert del_resp.status_code == 204

    list_after_del = client.get(f"/api/v1/cases/{case_id}/assets")
    assert len(list_after_del.json()) == 3

    # Storage cleanup for the remaining uploaded assets
    storage_paths = [xray_asset["storage_path"], ecg_asset["storage_path"], pdf_asset["storage_path"]]
    try:
        admin_client.storage.from_("medical-assets").remove(storage_paths)
    except Exception:
        pass
