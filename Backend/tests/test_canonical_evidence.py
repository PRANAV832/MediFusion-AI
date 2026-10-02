"""
Unit and Integration Tests for MediFusion Phase 11 Canonical Evidence System.
Verifies all 4 Evidence Types, Provenance Hierarchies, Graph Assembly,
and hard enforcement of the CRITICAL RULE (GENERATED_SYNTHESIS cannot support itself).
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.evidence import (
    EvidenceItem,
    EvidenceLink,
    EvidenceLinkType,
    EvidenceType,
    Finding,
    FindingSeverity,
    FindingStatus,
    ProvenanceRecord,
    validate_canonical_support,
)
from app.services.evidence import EvidenceService

client = TestClient(app)


def test_provenance_hierarchies():
    """
    Verify provenance structures for all 4 canonical evidence types:
      - MODEL_FINDING: model -> model run -> source asset
      - PATIENT_RECORD: document -> page -> chunk
      - TRUSTED_KNOWLEDGE: source -> document/chunk
      - GENERATED_SYNTHESIS: Gemini -> supporting evidence IDs
    """
    # 1. MODEL_FINDING
    mf_prov = ProvenanceRecord(
        evidence_type=EvidenceType.MODEL_FINDING,
        model_id="torchxrayvision-densenet-121",
        model_name="TorchXRayVision DenseNet-121",
        model_run_id="run-12345678-abcd",
        source_asset_id="asset-87654321",
        source_asset_filename="pa_chest_radiograph.png",
        modality="chest_xray",
    )
    assert len(mf_prov.trace_path) == 3
    assert mf_prov.trace_path[0] == "TorchXRayVision DenseNet-121"
    assert "Run #run-1234" in mf_prov.trace_path[1]
    assert mf_prov.trace_path[2] == "pa_chest_radiograph.png"

    # 2. PATIENT_RECORD
    pr_prov = ProvenanceRecord(
        evidence_type=EvidenceType.PATIENT_RECORD,
        document_id="doc-999",
        document_filename="discharge_summary.pdf",
        page_number=3,
        chunk_id="chk-456",
        chunk_index=2,
        domain="pulmonology",
        event_date="2026-09-15",
    )
    assert len(pr_prov.trace_path) == 3
    assert pr_prov.trace_path[0] == "discharge_summary.pdf"
    assert pr_prov.trace_path[1] == "Page 3"
    assert pr_prov.trace_path[2] == "Chunk #2"

    # 3. TRUSTED_KNOWLEDGE
    tk_prov = ProvenanceRecord(
        evidence_type=EvidenceType.TRUSTED_KNOWLEDGE,
        source_name="American Heart Association",
        document_title="CTR Criteria Guidelines",
        citation_reference="Circulation 2022; 145:e895",
    )
    assert len(tk_prov.trace_path) == 2
    assert tk_prov.trace_path[0] == "American Heart Association"
    assert tk_prov.trace_path[1] == "CTR Criteria Guidelines"

    # 4. GENERATED_SYNTHESIS
    gs_prov = ProvenanceRecord(
        evidence_type=EvidenceType.GENERATED_SYNTHESIS,
        generator="Gemini 3.8 Flash",
        supporting_evidence_ids=["evi-mod-1", "evi-rec-1"],
    )
    assert len(gs_prov.trace_path) == 2
    assert gs_prov.trace_path[0] == "Gemini 3.8 Flash"
    assert gs_prov.trace_path[1] == "2 Supporting Evidence Items"


def test_critical_rule_anti_self_referencing():
    """
    CRITICAL RULE:
    GENERATED_SYNTHESIS cannot support itself.
    It must point to actual evidence (MODEL_FINDING, PATIENT_RECORD, TRUSTED_KNOWLEDGE).
    """
    # Create actual evidence pool
    actual_item = EvidenceItem(
        id="evi-mod-actual-1",
        patient_id="pt-100",
        evidence_type=EvidenceType.MODEL_FINDING,
        title="Pneumonia Finding",
        summary="Probability 87.5%",
        confidence=0.875,
        provenance=ProvenanceRecord(
            evidence_type=EvidenceType.MODEL_FINDING,
            model_id="cxr-densenet",
            model_run_id="run-1",
            source_asset_id="asset-1",
            source_asset_filename="xray.png",
        ),
    )
    evidence_pool = {"evi-mod-actual-1": actual_item}

    # Case A: Direct Self-Reference (Synthesis citing its own ID)
    self_referencing_synthesis = EvidenceItem(
        id="evi-syn-self",
        patient_id="pt-100",
        evidence_type=EvidenceType.GENERATED_SYNTHESIS,
        title="Self Referencing Synthesis",
        summary="This synthesis cites itself",
        confidence=None,
        provenance=ProvenanceRecord(
            evidence_type=EvidenceType.GENERATED_SYNTHESIS,
            generator="Gemini",
            supporting_evidence_ids=["evi-syn-self"],
        ),
    )
    with pytest.raises(ValueError, match="CRITICAL_RULE_VIOLATION.*cannot support itself"):
        validate_canonical_support(self_referencing_synthesis, evidence_pool)

    # Case B: Empty supporting evidence IDs
    empty_supporting_synthesis = EvidenceItem(
        id="evi-syn-empty",
        patient_id="pt-100",
        evidence_type=EvidenceType.GENERATED_SYNTHESIS,
        title="Unsubstantiated Synthesis",
        summary="No citations provided",
        confidence=None,
        provenance=ProvenanceRecord(
            evidence_type=EvidenceType.GENERATED_SYNTHESIS,
            generator="Gemini",
            supporting_evidence_ids=[],
        ),
    )
    with pytest.raises(ValueError, match="CRITICAL_RULE_VIOLATION.*must point to actual evidence"):
        validate_canonical_support(empty_supporting_synthesis, evidence_pool)

    # Case C: Synthesis pointing ONLY to another synthesis in circular loop without actual evidence
    synthesis_b = EvidenceItem(
        id="evi-syn-b",
        patient_id="pt-100",
        evidence_type=EvidenceType.GENERATED_SYNTHESIS,
        title="Synthesis B",
        summary="Pointing to non-existent or other synthesis",
        confidence=None,
        provenance=ProvenanceRecord(
            evidence_type=EvidenceType.GENERATED_SYNTHESIS,
            generator="Gemini",
            supporting_evidence_ids=["evi-syn-a"],
        ),
    )
    synthesis_a = EvidenceItem(
        id="evi-syn-a",
        patient_id="pt-100",
        evidence_type=EvidenceType.GENERATED_SYNTHESIS,
        title="Synthesis A",
        summary="Pointing back to synthesis B",
        confidence=None,
        provenance=ProvenanceRecord(
            evidence_type=EvidenceType.GENERATED_SYNTHESIS,
            generator="Gemini",
            supporting_evidence_ids=["evi-syn-b"],
        ),
    )
    pool_circular = {"evi-syn-a": synthesis_a, "evi-syn-b": synthesis_b}
    with pytest.raises(ValueError, match="CRITICAL_RULE_VIOLATION.*Circular or synthesis-only support loops are forbidden"):
        validate_canonical_support(synthesis_a, pool_circular)

    # Case D: VALID synthesis pointing to actual evidence item
    valid_synthesis = EvidenceItem(
        id="evi-syn-valid",
        patient_id="pt-100",
        evidence_type=EvidenceType.GENERATED_SYNTHESIS,
        title="Valid Grounded Synthesis",
        summary="Properly points to actual model finding",
        confidence=None,
        provenance=ProvenanceRecord(
            evidence_type=EvidenceType.GENERATED_SYNTHESIS,
            generator="Gemini 3.8 Flash",
            supporting_evidence_ids=["evi-mod-actual-1"],
        ),
    )
    # Must succeed without error
    assert validate_canonical_support(valid_synthesis, evidence_pool) is True


def test_evidence_service_assembly_and_api():
    """
    Test end-to-end evidence graph assembly and API endpoints.
    """
    from app.core.security import AuthenticatedUser, get_current_user

    test_user = AuthenticatedUser(
        user_id="test-clinician-1",
        email="clinician@medifusion.health",
        profile={"id": "test-clinician-1", "role": "clinician"},
        token="mock_jwt",
    )
    app.dependency_overrides[get_current_user] = lambda: test_user

    # 1. Fetch any case to test live assembly
    cases_resp = client.get("/api/v1/cases/")
    assert cases_resp.status_code == 200
    cases_data = cases_resp.json()
    assert len(cases_data) > 0
    case_id = cases_data[0]["id"]
    patient_id = cases_data[0]["patient_id"]

    # 2. Test EvidenceService assembly directly
    service = EvidenceService()
    graph = service.assemble_case_evidence(case_id=case_id, patient_id=patient_id)
    assert graph.case_id == case_id
    assert graph.patient_id == patient_id
    assert len(graph.evidence_items) > 0
    assert "total_evidence_items" in graph.stats
    assert graph.stats["total_evidence_items"] >= 1

    # 3. Test API Endpoint GET /api/v1/evidence/case/{case_id}
    api_resp = client.get(f"/api/v1/evidence/case/{case_id}")
    assert api_resp.status_code == 200
    res_json = api_resp.json()
    assert res_json["case_id"] == case_id
    assert len(res_json["evidence_items"]) > 0

    # 4. Test API Endpoint POST /api/v1/evidence/case/{case_id}/synthesis - VIOLATION
    # Synthesis trying to cite non-existent/self
    bad_payload = {
        "title": "Invalid Self-Citing Synthesis",
        "summary": "Should be rejected by critical rule",
        "supporting_evidence_ids": ["evi-nonexistent-1234"],
    }
    bad_res = client.post(f"/api/v1/evidence/case/{case_id}/synthesis", json=bad_payload)
    assert bad_res.status_code == 422
    err_body = bad_res.json()
    err_msg = err_body.get("error", {}).get("message") or str(err_body.get("detail", ""))
    assert "CRITICAL_RULE_VIOLATION" in err_msg

    # 5. Test API Endpoint POST /api/v1/evidence/case/{case_id}/synthesis - VALID
    # Pick a real evidence ID from the graph
    valid_id = res_json["evidence_items"][0]["id"]
    good_payload = {
        "title": "Clinically Verified Multi-Evidence Synthesis",
        "summary": "Synthesized observation supported by canonical evidence.",
        "content": "Patient evaluated with complete provenance trace.",
        "supporting_evidence_ids": [valid_id],
    }
    good_res = client.post(f"/api/v1/evidence/case/{case_id}/synthesis", json=good_payload)
    assert good_res.status_code == 200
    created_item = good_res.json()
    assert created_item["evidence_type"] == "GENERATED_SYNTHESIS"
    assert valid_id in created_item["provenance"]["supporting_evidence_ids"]
