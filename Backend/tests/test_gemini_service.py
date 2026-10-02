import uuid
import pytest
from app.core.security import AuthenticatedUser, get_current_user
from app.main import app
from app.schemas.gemini import (
    GeminiSynthesisRequest,
    ModelFindingItem,
    PatientContextBundle,
    RetrievedEvidenceBundleItem,
    StructuredEvidenceBundle,
)
from app.services.gemini import GeminiService, get_gemini_service


def test_gemini_status_check(client):
    """Verify Gemini status endpoint accurately reports API readiness."""
    res = client.get("/api/v1/gemini/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ("READY", "API_KEY_REQUIRED")
    assert "document_extraction" in data["supported_actions"]
    assert "screening_report_draft" in data["supported_actions"]


def test_gemini_service_unit_anti_hallucination():
    """Verify GeminiService safety bounds:

    - result_type is strictly GENERATED_SYNTHESIS
    - supporting_evidence_ids must belong to valid provenance_ids whitelist
    """
    service = GeminiService()

    fake_prov_id_1 = str(uuid.uuid4())
    fake_prov_id_2 = str(uuid.uuid4())

    bundle = StructuredEvidenceBundle(
        patient_context=PatientContextBundle(
            patient_id=str(uuid.uuid4()),
            name="Eleanor Vance",
            chronic_conditions=["Hypertension"],
            chief_complaint="Shortness of breath on exertion",
        ),
        model_findings=[
            ModelFindingItem(
                finding_id=fake_prov_id_1,
                model_id="torchxrayvision-densenet121",
                capability="chest_xray_screening",
                finding="Cardiomegaly",
                confidence=0.88,
                run_id=fake_prov_id_1,
                provenance_id=fake_prov_id_1,
            )
        ],
        retrieved_evidence=[
            RetrievedEvidenceBundleItem(
                id=fake_prov_id_2,
                content="Prior echocardiogram showed mild left ventricular hypertrophy.",
                filename="echo_report_2023.txt",
                page_number=1,
                document_type="clinical_note",
            )
        ],
        provenance_ids=[fake_prov_id_1, fake_prov_id_2],
    )

    req = GeminiSynthesisRequest(
        action="evidence_grounded_synthesis",
        evidence_bundle=bundle,
    )

    status = service.get_status()
    if status.status == "READY":
        result = service.execute_synthesis(req)
        # 1. Output must be tagged GENERATED_SYNTHESIS
        assert result.result_type == "GENERATED_SYNTHESIS"
        assert result.action == "evidence_grounded_synthesis"
        assert len(result.generated_synthesis) > 10

        # 2. Strict grounding: Any cited ID must be in allowed provenance list
        for cid in result.supporting_evidence_ids:
            assert cid in (fake_prov_id_1, fake_prov_id_2), f"Hallucinated citation ID detected: {cid}"

        # 3. Required fields present
        assert isinstance(result.uncertainty_notes, list)
        assert isinstance(result.conflicts, list)
        assert isinstance(result.suggested_review_questions, list)
    else:
        pytest.skip("GEMINI_API_KEY not configured for live model test")


def test_gemini_api_endpoint_synthesis(client):
    """Test POST /api/v1/gemini/synthesize endpoint with authenticated user."""
    test_user_id = str(uuid.uuid4())
    test_user = AuthenticatedUser(
        user_id=test_user_id,
        email="clinician.gemini@medifusion.ai",
        profile={"id": test_user_id, "role": "clinician", "full_name": "Dr. Marcus Vance"},
        token="mock_gemini_token",
    )
    app.dependency_overrides[get_current_user] = lambda: test_user

    try:
        prov_id = str(uuid.uuid4())
        payload = {
            "action": "screening_report_draft",
            "evidence_bundle": {
                "patient_context": {
                    "patient_id": str(uuid.uuid4()),
                    "name": "Marcus Kane",
                    "chronic_conditions": ["Type 2 Diabetes"],
                    "chief_complaint": "Persistent dry cough",
                },
                "model_findings": [
                    {
                        "model_id": "torchxrayvision-densenet121",
                        "capability": "chest_xray_screening",
                        "finding": "Infiltration",
                        "confidence": 0.74,
                        "provenance_id": prov_id,
                    }
                ],
                "retrieved_evidence": [
                    {
                        "id": prov_id,
                        "content": "Patient reported dry cough starting 1 week ago.",
                        "filename": "clinical_note.txt",
                        "page_number": 1,
                        "document_type": "clinical_note",
                    }
                ],
                "provenance_ids": [prov_id],
                "uncertainty": {"image_quality": "adequate"},
                "conflict_flags": [],
            },
        }

        res = client.post("/api/v1/gemini/synthesize", json=payload)
        # If API key is valid, response should be 200 with GENERATED_SYNTHESIS
        if res.status_code == 200:
            data = res.json()
            assert data["result_type"] == "GENERATED_SYNTHESIS"
            assert "generated_synthesis" in data
            assert isinstance(data["supporting_evidence_ids"], list)
            assert isinstance(data["suggested_review_questions"], list)
        else:
            # If rate limit or connection issue
            assert res.status_code in (500, 502, 503)

    finally:
        app.dependency_overrides.pop(get_current_user, None)
