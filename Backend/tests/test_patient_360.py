import uuid
from datetime import datetime
from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


def test_patient_360_full_lifecycle(client):
    """Test full Patient 360 backend functionality: CRUD, summary, timeline, documents, and reports."""
    test_user_id = str(uuid.uuid4())
    test_user = AuthenticatedUser(
        user_id=test_user_id,
        email="clinician.test@medifusion.ai",
        profile={
            "id": test_user_id,
            "email": "clinician.test@medifusion.ai",
            "full_name": "Dr. Alex Rivera",
            "role": "clinician",
            "organization": "MediFusion Academic Health",
        },
        token="mock_jwt_token",
    )

    app.dependency_overrides[get_current_user] = lambda: test_user

    try:
        # 1. Create Patient
        random_suffix = uuid.uuid4().hex[:6].upper()
        mrn = f"MRN-360-{random_suffix}"
        patient_data = {
            "mrn": mrn,
            "first_name": "Gabriel",
            "last_name": "Mercer",
            "date_of_birth": "1972-11-20",
            "gender": "Male",
            "blood_type": "B+",
            "allergies": ["Sulfa drugs", "Aspirin"],
            "chronic_conditions": ["Type 2 Diabetes", "Asthma"],
        }
        res = client.post("/api/v1/patients/", json=patient_data)
        assert res.status_code == 201
        created = res.json()
        patient_id = created["id"]
        assert created["first_name"] == "Gabriel"

        # 2. Update Patient (PATCH)
        update_data = {
            "blood_type": "AB+",
            "chronic_conditions": ["Type 2 Diabetes", "Asthma", "Mild Sleep Apnea"],
        }
        update_res = client.patch(f"/api/v1/patients/{patient_id}", json=update_data)
        assert update_res.status_code == 200
        updated = update_res.json()
        assert updated["blood_type"] == "AB+"
        assert "Mild Sleep Apnea" in updated["chronic_conditions"]

        # 3. Add Timeline Event
        event_data = {
            "event_type": "consultation",
            "event_date": datetime.utcnow().isoformat(),
            "summary": "Initial pulmonary review following shortness of breath",
            "metadata": {"clinician_notes": "Bilateral wheezing noted on auscultation."},
        }
        event_res = client.post(f"/api/v1/patients/{patient_id}/timeline", json=event_data)
        assert event_res.status_code == 201
        assert event_res.json()["summary"] == "Initial pulmonary review following shortness of breath"

        # 4. Get Timeline
        timeline_res = client.get(f"/api/v1/patients/{patient_id}/timeline")
        assert timeline_res.status_code == 200
        events = timeline_res.json()
        assert len(events) >= 1
        assert events[0]["event_type"] == "consultation"

        # 5. Add Document
        doc_data = {
            "title": "Pulmonary Function Test (PFT)",
            "document_type": "lab_report",
            "document_date": "2026-09-15",
            "department": "Pulmonology",
            "author_name": "Dr. Sarah Miller",
            "summary": "FEV1/FVC ratio 68%, indicating mild obstructive pattern.",
        }
        doc_res = client.post(f"/api/v1/patients/{patient_id}/documents", json=doc_data)
        assert doc_res.status_code == 201
        assert doc_res.json()["title"] == "Pulmonary Function Test (PFT)"

        # 6. Get Documents
        docs_res = client.get(f"/api/v1/patients/{patient_id}/documents")
        assert docs_res.status_code == 200
        docs = docs_res.json()
        assert len(docs) >= 1
        assert docs[0]["document_type"] == "lab_report"

        # 7. Add Screening Report
        rep_data = {
            "title": "Baseline Multimodal Chest Screening",
            "report_type": "clinical_screening",
            "findings_summary": "No focal consolidation, mild hyperinflation consistent with history.",
            "recommendations": "Follow-up spirometry in 6 months.",
        }
        rep_res = client.post(f"/api/v1/patients/{patient_id}/reports", json=rep_data)
        assert rep_res.status_code == 201
        assert rep_res.json()["title"] == "Baseline Multimodal Chest Screening"

        # 8. Get Reports
        reports_res = client.get(f"/api/v1/patients/{patient_id}/reports")
        assert reports_res.status_code == 200
        assert len(reports_res.json()) >= 1

        # 9. Get Patient Summary (Patient 360 overview metrics)
        summary_res = client.get(f"/api/v1/patients/{patient_id}/summary")
        assert summary_res.status_code == 200
        summary = summary_res.json()
        assert summary["total_events"] >= 1
        assert summary["total_documents"] >= 1
        assert summary["total_reports"] >= 1
        assert "Mild Sleep Apnea" in summary["active_conditions"]

        # 10. Filter Search Test
        search_res = client.get(f"/api/v1/patients/?search={mrn}")
        assert search_res.status_code == 200
        assert len(search_res.json()) == 1
        assert search_res.json()[0]["mrn"] == mrn

        # 11. Delete Patient
        del_res = client.delete(f"/api/v1/patients/{patient_id}")
        assert del_res.status_code == 204

        # 12. Verify Deleted (404)
        get_deleted = client.get(f"/api/v1/patients/{patient_id}")
        assert get_deleted.status_code == 404

    finally:
        app.dependency_overrides.clear()
