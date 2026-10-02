"""Pydantic schemas for Phase 13 Real-Time Orchestration Graph & Event Reconstruction.

Covers:
- Canonical Execution States: QUEUED, RUNNING, COMPLETED, FAILED, REVIEW_REQUIRED
- 14 Backend Event Types
- 10 Graph Node Stages
- Chronological event reconstruction payload
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class OrchestrationState(str, Enum):
    """Execution lifecycle states."""
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"


class OrchestrationEventType(str, Enum):
    """Specific granular backend event types."""
    CASE_ACCEPTED = "case_accepted"
    ASSET_INSPECTION = "asset_inspection"
    RAG_RETRIEVAL = "rag_retrieval"
    CAPABILITY_SELECTION = "capability_selection"
    MODEL_SELECTION = "model_selection"
    RESOURCE_CHECK = "resource_check"
    MODEL_LOAD = "model_load"
    INFERENCE = "inference"
    EVIDENCE_CREATION = "evidence_creation"
    CONFLICT_DETECTION = "conflict_detection"
    GEMINI_SYNTHESIS = "gemini_synthesis"
    REPORT_GENERATION = "report_generation"
    ERROR = "error"
    REVIEW_REQUIRED = "review_required"


class GraphStageNode(str, Enum):
    """The 10 discrete nodes on the sequential clinical execution graph."""
    CASE = "CASE"
    INPUTS = "INPUTS"
    CAPABILITY_SELECTION = "CAPABILITY_SELECTION"
    RESOURCE_CHECK = "RESOURCE_CHECK"
    SPECIALIZED_MODEL = "SPECIALIZED_MODEL"
    MODEL_FINDING = "MODEL_FINDING"
    EVIDENCE = "EVIDENCE"
    CONFLICT_UNCERTAINTY = "CONFLICT_UNCERTAINTY"
    GEMINI = "GEMINI"
    REPORT = "REPORT"


class OrchestrationEventItem(BaseModel):
    """An individual event logged during real case orchestration."""
    id: str
    run_id: str
    case_id: str
    patient_id: str
    event_type: OrchestrationEventType
    stage_node: GraphStageNode
    state: OrchestrationState
    title: str
    message: str
    sequence: int
    duration_ms: Optional[float] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class GraphNodeState(BaseModel):
    """State for a single node in the React Flow graph."""
    id: str
    node_type: GraphStageNode
    label: str
    sublabel: Optional[str] = None
    state: OrchestrationState = OrchestrationState.QUEUED
    duration_ms: Optional[float] = None
    summary: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    updated_at: Optional[datetime] = None


class GraphEdgeState(BaseModel):
    """State for a directed edge between two stage nodes."""
    id: str
    source: str
    target: str
    animated: bool = False
    status: str = "default"  # 'idle', 'active', 'completed', 'error', 'review'


class ReconstructedGraphState(BaseModel):
    """Complete reconstructed React Flow graph state derived from stored backend events."""
    run_id: str
    case_id: str
    patient_id: str
    overall_state: OrchestrationState
    active_stage: Optional[str] = None
    nodes: List[GraphNodeState]
    edges: List[GraphEdgeState]
    events: List[OrchestrationEventItem]
    total_duration_ms: float = 0.0
    completed_nodes_count: int = 0
    total_nodes_count: int = 10
    has_review_required: bool = False
    review_reasons: List[str] = Field(default_factory=list)
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ExecuteOrchestrationRequest(BaseModel):
    """Trigger real live multi-stage orchestration execution for a case."""
    force_recompute: bool = False
    simulate_delay_ms: int = Field(default=0, ge=0, le=2000, description="Optional throttle to observe live WebSocket stream")


class OrchestrationRunSummary(BaseModel):
    """Summary of an orchestration run."""
    id: str
    case_id: str
    patient_id: str
    state: OrchestrationState
    active_stage: str
    total_events: int
    error_message: Optional[str] = None
    review_reasons: List[str] = Field(default_factory=list)
    created_at: datetime
    completed_at: Optional[datetime] = None
