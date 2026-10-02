import uuid
from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


def test_unauthenticated_access_rejected(client):
    """Verify that protected endpoints reject requests without Authorization header."""
    res_me = client.get("/api/v1/auth/me")
    assert res_me.status_code == 401

    res_patients = client.get("/api/v1/patients/")
    assert res_patients.status_code == 401

    res_cases = client.get("/api/v1/cases/")
    assert res_cases.status_code == 401


def test_invalid_bearer_token_rejected(client):
    """Verify that forged/invalid tokens are rejected."""
    headers = {"Authorization": "Bearer totally_invalid_token_xyz"}
    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 401


def test_authenticated_patient_and_case_crud(client):
    """Test full authenticated CRUD lifecycle for patient and case using dependency override."""
    test_user_id = str(uuid.uuid4())
    test_user = AuthenticatedUser(
        user_id=test_user_id,
        email="test_doctor@medifusion.ai",
        profile={
            "id": test_user_id,
            "email": "test_doctor@medifusion.ai",
            "full_name": "Dr. Sarah Chen",
            "role": "clinician",
            "organization": "MediFusion AI Test Clinic",
        },
        token="mock_valid_token",
    )

    # Override get_current_user dependency to simulate verified clinician
    app.dependency_overrides[get_current_user] = lambda: test_user

    try:
        # 1. Verify /auth/me returns current clinician
        me_res = client.get("/api/v1/auth/me")
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert me_data["email"] == "test_doctor@medifusion.ai"
        assert me_data["role"] == "clinician"

        # 2. Test Database Write: Create Patient
        random_suffix = uuid.uuid4().hex[:6].upper()
        unique_mrn = f"MRN-TEST-{random_suffix}"
        patient_payload = {
            "mrn": unique_mrn,
            "first_name": "Eleanor",
            "last_name": "Vance",
            "date_of_birth": "1985-04-12",
            "gender": "Female",
            "blood_type": "O+",
            "allergies": ["Penicillin"],
            "chronic_conditions": ["Hypertension"],
        }

        create_pat_res = client.post("/api/v1/patients/", json=patient_payload)
        assert create_pat_res.status_code == 201
        created_pat = create_pat_res.json()
        assert created_pat["mrn"] == unique_mrn
        patient_id = created_pat["id"]

        # 3. Test Database Read: Get Patient by ID
        get_pat_res = client.get(f"/api/v1/patients/{patient_id}")
        assert get_pat_res.status_code == 200
        assert get_pat_res.json()["first_name"] == "Eleanor"

        # 4. Test Database Read: List Patients
        list_pat_res = client.get("/api/v1/patients/")
        assert list_pat_res.status_code == 200
        mrn_list = [p["mrn"] for p in list_pat_res.json()]
        assert unique_mrn in mrn_list

        # 5. Test Duplicate MRN Conflict (Constraint check)
        dup_res = client.post("/api/v1/patients/", json=patient_payload)
        assert dup_res.status_code == 409

        # 6. Test Database Write: Create Case attached to Patient
        case_payload = {
            "patient_id": patient_id,
            "title": "Persistent Headaches and Dizziness",
            "chief_complaint": "Severe unilateral temporal headache with visual disturbance",
            "symptoms": ["headache", "dizziness", "photophobia"],
            "priority": "urgent",
            "clinical_notes": "Patient presents with 2-week history of worsening symptoms.",
        }

        create_case_res = client.post("/api/v1/cases/", json=case_payload)
        assert create_case_res.status_code == 201
        created_case = create_case_res.json()
        assert created_case["patient_id"] == patient_id
        case_id = created_case["id"]

        # 7. Test Database Read: Get Case by ID
        get_case_res = client.get(f"/api/v1/cases/{case_id}")
        assert get_case_res.status_code == 200
        assert get_case_res.json()["title"] == "Persistent Headaches and Dizziness"

        # 8. Test Non-existent Patient ID failure
        invalid_id = str(uuid.uuid4())
        bad_get = client.get(f"/api/v1/patients/{invalid_id}")
        assert bad_get.status_code == 404

    finally:
        app.dependency_overrides.clear()
