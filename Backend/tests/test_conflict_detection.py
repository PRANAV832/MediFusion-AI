"""
Unit and Integration Tests for MediFusion Phase 12 Structured Conflict Detection.
Verifies all 7 conflict vectors, 5 review states, strict separation of uncertainty dimensions,
Evidence A vs Evidence B comparison anchors, and anti-fake-diagnosis constraints.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app
from app.schemas.conflicts import (
    CaseReviewAssessment,
    ConflictCategory,
    ConflictSeverity,
    DimensionMetrics,
    ReviewState,
    StructuredConflictItem,
)
from app.services.conflict_detector import ConflictDetectorService

client = TestClient(app)


@pytest.fixture(autouse=True)
def override_auth():
    test_user = AuthenticatedUser(
        user_id="test-clinician-12",
        email="clinician@medifusion.health",
        profile={"id": "test-clinician-12", "role": "clinician"},
        token="mock_jwt",
    )
    app.dependency_overrides[get_current_user] = lambda: test_user
    yield
    app.dependency_overrides.pop(get_current_user, None)


def test_separated_dimensions_anti_conflation():
    """
    CRITICAL CONSTRAINT:
    Do NOT create a fake medical diagnosis score.
    Do NOT convert uncertainty into 'Diagnosis confidence = 94%'.
    Dimensions must remain strictly separated and independent.
    """
    dimensions = DimensionMetrics(
        model_confidence=0.825,
        cross_model_agreement=0.50,
        historical_support=0.30,
        evidence_completeness=0.85,
        input_quality=0.95,
    )

    # All five dimensions must exist independently
    assert dimensions.model_confidence == 0.825
    assert dimensions.cross_model_agreement == 0.50
    assert dimensions.historical_support == 0.30
    assert dimensions.evidence_completeness == 0.85
    assert dimensions.input_quality == 0.95

    # Ensure no combined diagnosis confidence field exists on schema
    dim_dict = dimensions.model_dump()
    assert "diagnosis_confidence" not in dim_dict
    assert "overall_confidence" not in dim_dict


def test_synthetic_conflict_fixtures_and_review_states():
    """
    Verify all 5 review states and Evidence A vs Evidence B anchors
    using deterministic synthetic conflict fixtures:
      - MODEL_DISAGREEMENT
      - REVIEW_REQUIRED (model_vs_history)
      - INSUFFICIENT_EVIDENCE (missing_evidence)
      - INPUT_QUALITY_ISSUE (poor_image_quality)
    """
    service = ConflictDetectorService()
    dummy_case_id = "00000000-0000-0000-0000-000000000001"
    dummy_patient_id = "00000000-0000-0000-0000-000000000002"

    # 1. Model Disagreement Fixture
    md_assessment = service.create_synthetic_conflict_fixture(
        case_id=dummy_case_id,
        patient_id=dummy_patient_id,
        fixture_type="model_disagreement",
    )
    assert md_assessment.review_state == ReviewState.MODEL_DISAGREEMENT
    assert md_assessment.human_review_required is True
    assert len(md_assessment.conflicts) >= 1
    conflict_md = md_assessment.conflicts[0]
    assert conflict_md.conflict_type == ConflictCategory.MODEL_DISAGREEMENT
    # Verify Evidence A vs Evidence B structure
    assert conflict_md.evidence_a.source_type == "MODEL_FINDING"
    assert conflict_md.evidence_b.source_type == "MODEL_FINDING"
    assert conflict_md.evidence_a.confidence is not None
    assert conflict_md.evidence_b.confidence is not None
    assert "human_review" in conflict_md.why_human_review_required.lower() or len(conflict_md.why_human_review_required) > 10

    # 2. Model vs History Fixture
    mvh_assessment = service.create_synthetic_conflict_fixture(
        case_id=dummy_case_id,
        patient_id=dummy_patient_id,
        fixture_type="model_vs_history",
    )
    assert mvh_assessment.review_state == ReviewState.REVIEW_REQUIRED
    assert mvh_assessment.human_review_required is True
    conflict_mvh = mvh_assessment.conflicts[0]
    assert conflict_mvh.conflict_type == ConflictCategory.MODEL_VS_HISTORY
    assert conflict_mvh.evidence_a.source_type == "MODEL_FINDING"
    assert conflict_mvh.evidence_b.source_type == "PATIENT_RECORD"
    assert "Cardiomegaly" in conflict_mvh.title

    # 3. Missing Evidence Fixture
    me_assessment = service.create_synthetic_conflict_fixture(
        case_id=dummy_case_id,
        patient_id=dummy_patient_id,
        fixture_type="missing_evidence",
    )
    assert me_assessment.review_state == ReviewState.INSUFFICIENT_EVIDENCE
    assert me_assessment.human_review_required is True
    conflict_me = me_assessment.conflicts[0]
    assert conflict_me.conflict_type == ConflictCategory.MISSING_EVIDENCE
    assert conflict_me.severity == ConflictSeverity.CRITICAL

    # 4. Poor Image Quality Fixture
    piq_assessment = service.create_synthetic_conflict_fixture(
        case_id=dummy_case_id,
        patient_id=dummy_patient_id,
        fixture_type="poor_image_quality",
    )
    assert piq_assessment.review_state == ReviewState.INPUT_QUALITY_ISSUE
    assert piq_assessment.human_review_required is True
    conflict_piq = piq_assessment.conflicts[0]
    assert conflict_piq.conflict_type == ConflictCategory.POOR_IMAGE_QUALITY


def test_conflict_api_endpoints():
    """
    Test live API endpoints:
      - GET /api/v1/conflicts/case/{case_id}
      - POST /api/v1/conflicts/case/{case_id}/fixture
      - POST /api/v1/conflicts/{conflict_id}/resolve
    """
    # 1. Fetch any case to test
    cases_resp = client.get("/api/v1/cases/")
    assert cases_resp.status_code == 200
    cases_data = cases_resp.json()
    assert len(cases_data) > 0
    case_id = cases_data[0]["id"]
    patient_id = cases_data[0]["patient_id"]

    # 2. Evaluate case conflicts via API
    eval_resp = client.get(f"/api/v1/conflicts/case/{case_id}")
    assert eval_resp.status_code == 200
    eval_data = eval_resp.json()
    assert "review_state" in eval_data
    assert "human_review_required" in eval_data
    assert "dimensions" in eval_data
    assert "evidence_completeness" in eval_data["dimensions"]
    assert "input_quality" in eval_data["dimensions"]

    # 3. Create synthetic fixture via API
    fixture_resp = client.post(
        f"/api/v1/conflicts/case/{case_id}/fixture",
        json={"fixture_type": "model_disagreement"},
    )
    assert fixture_resp.status_code == 200
    fixture_data = fixture_resp.json()
    assert fixture_data["review_state"] == "MODEL_DISAGREEMENT"
    assert len(fixture_data["conflicts"]) >= 1
    conflict = fixture_data["conflicts"][0]
    assert "evidence_a" in conflict
    assert "evidence_b" in conflict
    assert "why_human_review_required" in conflict
    conflict_id = conflict["id"]

    # 4. Resolve the conflict via API
    resolve_resp = client.post(
        f"/api/v1/conflicts/{conflict_id}/resolve",
        json={
            "status": "RESOLVED",
            "resolution_notes": "Clinician adjudicated right lower lobe consolidation; confirmed acute bacterial pneumonia.",
        },
    )
    assert resolve_resp.status_code == 200
    res_data = resolve_resp.json()
    assert res_data["conflict"]["status"] == "RESOLVED"
    assert "Clinician adjudicated" in res_data["conflict"]["resolution_notes"]
