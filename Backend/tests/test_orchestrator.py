"""Automated unit and integration tests for Phase 7 Intelligent Model Orchestrator."""

import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import AuthenticatedUser, get_current_user
from app.orchestration.resource_state import inspect_resource_state, check_resource_fit
from app.orchestration.dag import ExecutionDAG, DAGNode
from app.orchestration.core import model_orchestrator


@pytest.fixture
def auth_client():
    mock_user = AuthenticatedUser(
        user_id="00000000-0000-0000-0000-000000000001",
        email="orchestrator_tester@medifusion.ai",
        profile={"id": "00000000-0000-0000-0000-000000000001", "role": "clinician", "full_name": "Dr. Orchestrator Tester"},
        token="mock_token",
    )
    app.dependency_overrides[get_current_user] = lambda: mock_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_current_user, None)


def test_resource_state_inspection():
    """Verify host RAM, CPU cores, and GPU VRAM snapshot."""
    snapshot = inspect_resource_state()
    assert snapshot.total_ram_mb > 0
    assert snapshot.available_ram_mb > 0
    assert snapshot.cpu_cores >= 1

    # Check reasonable headroom for typical 512MB model
    fits, reason = check_resource_fit(required_ram_mb=512, safety_margin_mb=128)
    assert fits is True
    assert "Resource check passed" in reason

    # Check excessive RAM request fails cleanly
    fits_huge, reason_huge = check_resource_fit(required_ram_mb=99999999)
    assert fits_huge is False
    assert "Insufficient RAM" in reason_huge


def test_dag_construction_and_topological_sort():
    """Verify DAG building, cycle-free topological sort, and dependency satisfaction."""
    dag = ExecutionDAG()

    doc_node = DAGNode(
        id="node_doc_extraction",
        label="Document Extraction",
        node_type="document_pipeline",
        modality="document",
        status="ready",
    )
    rag_node = DAGNode(
        id="node_doc_rag",
        label="Patient RAG",
        node_type="document_pipeline",
        modality="document",
        status="ready",
    )
    model_node = DAGNode(
        id="node_cxr_model",
        label="CXR DenseNet Model",
        node_type="specialized_model",
        modality="chest_xray",
        status="ready",
    )
    collation_node = DAGNode(
        id="node_collation",
        label="Evidence Collation",
        node_type="evidence_synthesis",
        modality="multimodal",
        status="ready",
    )

    dag.add_node(doc_node)
    dag.add_node(rag_node)
    dag.add_node(model_node)
    dag.add_node(collation_node)

    # Add dependencies
    dag.add_edge("node_doc_extraction", "node_doc_rag", relationship="data_flow")
    dag.add_edge("node_doc_rag", "node_collation", relationship="evidence_fusion")
    dag.add_edge("node_cxr_model", "node_collation", relationship="evidence_fusion")

    order = dag.topological_sort()
    assert len(order) == 4

    # Assert dependency constraints
    assert order.index("node_doc_extraction") < order.index("node_doc_rag")
    assert order.index("node_doc_rag") < order.index("node_collation")
    assert order.index("node_cxr_model") < order.index("node_collation")


def test_orchestration_algorithm_exact_user_scenario():
    """Verify user example: ECG + Chest X-ray + PDF produces ECG, CXR, Document/RAG and skips Brain & Skin."""
    mock_case_id = str(uuid.uuid4())
    mock_patient_id = str(uuid.uuid4())

    case_metadata = {
        "title": "Multimodal Cardiopulmonary Evaluation",
        "chief_complaint": "Shortness of breath, productive cough, palpitations",
        "clinical_summary": "Patient reports 3-day history of fever, chest discomfort, and coughing up greenish sputum.",
        "initial_impression": "Evaluate for community-acquired pneumonia and concurrent cardiac arrhythmia.",
    }

    # Ingested assets matching user's exact specification:
    # 1. ECG asset
    # 2. Chest X-ray asset
    # 3. PDF document asset
    assets = [
        {
            "id": "asset-ecg-01",
            "case_id": mock_case_id,
            "filename": "resting_12lead_ecg.csv",
            "modality": "ecg",
            "mime_type": "text/csv",
            "size_bytes": 128000,
        },
        {
            "id": "asset-cxr-01",
            "case_id": mock_case_id,
            "filename": "chest_xray_pa.png",
            "modality": "chest_xray",
            "mime_type": "image/png",
            "size_bytes": 2048000,
        },
        {
            "id": "asset-doc-01",
            "case_id": mock_case_id,
            "filename": "prior_discharge_summary.pdf",
            "modality": "clinical_note",
            "mime_type": "application/pdf",
            "size_bytes": 512000,
        },
    ]

    plan = model_orchestrator.plan_case_execution(
        case_id=mock_case_id,
        patient_id=mock_patient_id,
        case_metadata=case_metadata,
        assets=assets,
        symptoms_context="cough, fever, palpitations",
        force_replan=True,
    )

    # 1. Inspect case modalities
    assert "chest_xray" in plan["input_modalities"]
    assert "ecg" in plan["input_modalities"]
    assert "document" in plan["input_modalities"]

    # 2. Selected Models must include:
    # - Chest X-ray models (Pneumonia and Lung Opacity)
    # - Document/RAG pipeline
    selected_caps = [m["capability_id"] for m in plan["selected_models"]]
    assert "pneumonia_screening" in selected_caps
    assert "lung_opacity_abnormality_screening" in selected_caps
    assert "document_rag_pipeline" in selected_caps

    # 3. Skipped Capabilities:
    # Brain MRI, Brain stroke, and Skin must be skipped because no MRI/CT/Skin assets exist
    skipped_caps = {s["capability_id"]: s for s in plan["skipped_capabilities"]}
    assert "brain_tumor_screening" in skipped_caps
    assert "skin_lesion_screening" in skipped_caps
    assert "brain_stroke_abnormality_screening" in skipped_caps
    assert skipped_caps["brain_tumor_screening"]["status"] == "skipped_no_asset"
    assert skipped_caps["skin_lesion_screening"]["status"] == "skipped_no_asset"

    # ECG was present in assets, but ECG model adapter is NOT_CONFIGURED
    # It must be skipped from active execution to guarantee ZERO fake predictions!
    assert "arrhythmia_cardiac_abnormality_screening" in skipped_caps
    assert skipped_caps["arrhythmia_cardiac_abnormality_screening"]["status"] == "skipped_not_configured"
    assert "NOT_CONFIGURED" in skipped_caps["arrhythmia_cardiac_abnormality_screening"]["skip_reason"]

    # 4. Selection Reasons must be deterministic and auditable
    assert "pneumonia_screening" in plan["selection_reasons"]
    assert "cough" in plan["selection_reasons"]["pneumonia_screening"]
    assert "document_rag_pipeline" in plan["selection_reasons"]

    # 5. DAG and Execution Order
    assert len(plan["execution_order"]) > 0
    step_labels = [step["label"] for step in plan["execution_order"]]
    assert "Document Text & Structure Extraction" in step_labels
    assert "Multimodal Evidence Collation & Uncertainty Check" in step_labels


def test_orchestration_api_endpoints(auth_client: TestClient):
    """Verify RESTful API endpoints for model orchestration and resource querying."""
    # 1. Test resources endpoint
    res_resp = auth_client.get("/api/v1/orchestration/resources")
    assert res_resp.status_code == 200
    res_data = res_resp.json()
    assert "total_ram_mb" in res_data
    assert "available_ram_mb" in res_data
    assert "cpu_cores" in res_data
