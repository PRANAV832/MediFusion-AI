"""
Unit & Integration Tests for Phase 13 Real-Time Orchestration Graph & Event Reconstruction.

Verifies:
1. All 14 backend event types and 10 graph stage nodes.
2. Canonical lifecycle states: QUEUED, RUNNING, COMPLETED, FAILED, REVIEW_REQUIRED.
3. Event persistence and accurate historical graph reconstruction without fake timers.
4. HTTP and WebSocket streaming endpoints.
"""

import pytest
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app
from app.schemas.orchestration_graph import (
    GraphStageNode,
    OrchestrationEventType,
    OrchestrationState,
    ReconstructedGraphState,
)
from app.orchestration.live_executor import live_orchestrator

client = TestClient(app)


@pytest.fixture(autouse=True)
def override_auth():
    uid = str(uuid.uuid4())
    test_user = AuthenticatedUser(
        user_id=uid,
        email="clinician.live@medifusion.health",
        profile={"id": uid, "role": "clinician", "email": "clinician.live@medifusion.health", "full_name": "Dr. Eleanor Vance"},
        token="mock_jwt_13",
    )
    app.dependency_overrides[get_current_user] = lambda: test_user
    yield
    app.dependency_overrides.pop(get_current_user, None)


def test_orchestration_enums_and_constants():
    """Verify all 14 backend event types and 10 graph nodes exist in definitions."""
    # 14 Backend events
    expected_events = [
        "case_accepted",
        "asset_inspection",
        "rag_retrieval",
        "capability_selection",
        "model_selection",
        "resource_check",
        "model_load",
        "inference",
        "evidence_creation",
        "conflict_detection",
        "gemini_synthesis",
        "report_generation",
        "error",
        "review_required",
    ]
    for ev in expected_events:
        assert OrchestrationEventType(ev) is not None

    # 10 Graph Stage Nodes
    expected_nodes = [
        "CASE",
        "INPUTS",
        "CAPABILITY_SELECTION",
        "RESOURCE_CHECK",
        "SPECIALIZED_MODEL",
        "MODEL_FINDING",
        "EVIDENCE",
        "CONFLICT_UNCERTAINTY",
        "GEMINI",
        "REPORT",
    ]
    for node in expected_nodes:
        assert GraphStageNode(node) is not None

    # 5 Canonical Review/Execution States
    expected_states = ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "REVIEW_REQUIRED"]
    for st in expected_states:
        assert OrchestrationState(st) is not None


def test_graph_reconstruction_from_scratch():
    """Verify clean graph reconstruction for a fresh or unrun case."""
    fake_case_id = str(uuid.uuid4())
    graph = live_orchestrator.reconstruct_graph_from_events(fake_case_id)

    assert isinstance(graph, ReconstructedGraphState)
    assert graph.overall_state == OrchestrationState.QUEUED
    assert len(graph.nodes) == 10
    assert len(graph.edges) == 9
    assert graph.completed_nodes_count == 0

    # Ensure all 10 stages are present in exact sequential order
    node_ids = [n.id for n in graph.nodes]
    assert node_ids == [
        "CASE",
        "INPUTS",
        "CAPABILITY_SELECTION",
        "RESOURCE_CHECK",
        "SPECIALIZED_MODEL",
        "MODEL_FINDING",
        "EVIDENCE",
        "CONFLICT_UNCERTAINTY",
        "GEMINI",
        "REPORT",
    ]


@pytest.mark.asyncio
async def test_live_orchestration_event_stream_and_graph_endpoints():
    """
    Integration test: Creates a real case, runs live multi-stage orchestration stream,
    and verifies that all events were stored and the graph is faithfully reconstructed.
    """
    # 1. Create Patient & Case
    suffix = uuid.uuid4().hex[:6]
    p_resp = client.post(
        "/api/v1/patients/",
        json={
            "mrn": f"MRN-LIVE-{suffix}",
            "first_name": "Eleanor",
            "last_name": "Vance",
            "date_of_birth": "1975-08-14",
            "gender": "Female",
        },
    )
    assert p_resp.status_code == 201
    patient_id = p_resp.json()["id"]

    c_resp = client.post(
        "/api/v1/cases/",
        json={
            "patient_id": patient_id,
            "case_number": f"CASE-LIVE-{suffix}",
            "title": "Severe Dyspnea & Suspected Lower Respiratory Infection",
            "chief_complaint": "Acute onset dyspnea, productive cough with rust-colored sputum, fever 38.8C",
            "symptoms": ["dyspnea", "cough", "fever", "chest pain"],
            "priority": "urgent",
        },
    )
    assert c_resp.status_code == 201
    case_id = c_resp.json()["id"]

    # 2. Trigger Live Execution via HTTP endpoint
    exec_resp = client.post(
        f"/api/v1/orchestration-graph/case/{case_id}/execute",
        json={"force_recompute": True, "simulate_delay_ms": 0},
    )
    assert exec_resp.status_code == 200
    graph_data = exec_resp.json()

    assert graph_data["case_id"] == case_id
    assert graph_data["patient_id"] == patient_id
    assert graph_data["total_nodes_count"] == 10
    assert len(graph_data["nodes"]) == 10
    assert len(graph_data["edges"]) == 9
    assert len(graph_data["events"]) >= 10  # Emitted all pipeline events

    # Check stage progression: CASE, INPUTS, CAPABILITY_SELECTION, RESOURCE_CHECK completed
    node_map = {n["id"]: n for n in graph_data["nodes"]}
    assert node_map["CASE"]["state"] == "COMPLETED"
    assert node_map["INPUTS"]["state"] == "COMPLETED"
    assert node_map["CAPABILITY_SELECTION"]["state"] == "COMPLETED"
    assert node_map["RESOURCE_CHECK"]["state"] == "COMPLETED"

    # 3. Retrieve Reconstructed Graph via GET
    get_resp = client.get(f"/api/v1/orchestration-graph/case/{case_id}/graph")
    assert get_resp.status_code == 200
    retrieved_graph = get_resp.json()
    assert retrieved_graph["run_id"] == graph_data["run_id"]
    assert retrieved_graph["total_duration_ms"] > 0

    # 4. List Historical Runs
    runs_resp = client.get(f"/api/v1/orchestration-graph/case/{case_id}/runs")
    assert runs_resp.status_code == 200
    runs = runs_resp.json()
    assert len(runs) >= 1
    assert runs[0]["case_id"] == case_id


def test_websocket_stream_connection():
    """Verify WebSocket endpoint connects and streams live events."""
    suffix = uuid.uuid4().hex[:6]
    p_resp = client.post(
        "/api/v1/patients/",
        json={
            "mrn": f"MRN-WS-{suffix}",
            "first_name": "Lucas",
            "last_name": "Sinclair",
            "date_of_birth": "1988-03-22",
            "gender": "Male",
        },
    )
    assert p_resp.status_code == 201
    patient_id = p_resp.json()["id"]

    c_resp = client.post(
        "/api/v1/cases/",
        json={
            "patient_id": patient_id,
            "case_number": f"CASE-WS-{suffix}",
            "title": "Persistent Palpitations and Chest Discomfort",
            "chief_complaint": "Episodic tachycardia and presyncope during exertion",
            "symptoms": ["palpitations", "syncope", "chest pain"],
            "priority": "routine",
        },
    )
    assert c_resp.status_code == 201
    case_id = c_resp.json()["id"]

    # Connect WebSocket
    events_received = []
    with client.websocket_connect(f"/api/v1/orchestration-graph/ws/case/{case_id}?throttle_ms=0") as websocket:
        while True:
            try:
                data = websocket.receive_json()
                events_received.append(data)
                if data.get("type") == "ORCHESTRATION_COMPLETED":
                    break
            except Exception:
                break

    assert len(events_received) >= 10
    # Final message is ORCHESTRATION_COMPLETED with graph
    assert events_received[-1]["type"] == "ORCHESTRATION_COMPLETED"
    assert "graph" in events_received[-1]
