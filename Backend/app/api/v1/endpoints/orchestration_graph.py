"""
FastAPI HTTP & WebSocket Endpoints for Phase 13 Real-Time React Flow Orchestration Graph.
"""

import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import ValidationError

from app.core.security import AuthenticatedUser, get_current_user
from app.orchestration.live_executor import live_orchestrator
from app.schemas.orchestration_graph import (
    ExecuteOrchestrationRequest,
    OrchestrationEventItem,
    OrchestrationRunSummary,
    ReconstructedGraphState,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/case/{case_id}/graph", response_model=ReconstructedGraphState)
def get_case_reconstructed_graph(
    case_id: str,
    run_id: Optional[str] = Query(None, description="Specific run ID to reconstruct; if null, fetches latest"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Reconstructs the React Flow orchestration graph strictly from persisted backend events.
    Zero fake animated timers: Every node and edge state reflects actual persisted milestones.
    """
    try:
        return live_orchestrator.reconstruct_graph_from_events(case_id, run_id=run_id)
    except Exception as e:
        logger.error(f"Error reconstructing graph for case {case_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reconstruct graph: {str(e)}",
        )


@router.get("/case/{case_id}/runs", response_model=List[OrchestrationRunSummary])
def list_case_orchestration_runs(
    case_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Retrieve historical orchestration runs for a case to reconstruct past graph runs."""
    try:
        res = (
            live_orchestrator.db.table("case_orchestration_runs")
            .select("id, case_id, patient_id, state, active_stage, total_events, error_message, review_reasons, created_at, completed_at")
            .eq("case_id", case_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list orchestration runs: {str(e)}",
        )


@router.post("/case/{case_id}/execute", response_model=ReconstructedGraphState)
async def execute_live_orchestration_sync(
    case_id: str,
    req: ExecuteOrchestrationRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Trigger live execution across all clinical stages synchronously and return
    the final reconstructed graph state.
    """
    try:
        # Run through the event stream to completion
        async for _ in live_orchestrator.execute_case_orchestration_stream(
            case_id=case_id,
            delay_ms=0,
        ):
            pass

        return live_orchestrator.reconstruct_graph_from_events(case_id)
    except Exception as e:
        logger.error(f"Error during orchestration execution: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Orchestration execution failed: {str(e)}",
        )


@router.websocket("/ws/case/{case_id}")
async def websocket_orchestration_stream(
    websocket: WebSocket,
    case_id: str,
    throttle_ms: int = Query(150, description="Optional delay between events for smooth real-time visualization"),
):
    """
    WebSocket endpoint streaming live orchestration events as they occur in real time.
    Sends each event object over the wire, allowing the frontend React Flow graph to transition
    node states dynamically without any fake timers.
    """
    await websocket.accept()
    logger.info(f"WebSocket client connected for case orchestration stream: case_id={case_id}")

    try:
        # Stream live events directly as they are generated and persisted
        async for event in live_orchestrator.execute_case_orchestration_stream(
            case_id=case_id,
            delay_ms=throttle_ms,
        ):
            await websocket.send_text(json.dumps(event))

        # Send final completion message with full reconstructed graph
        final_graph = live_orchestrator.reconstruct_graph_from_events(case_id)
        await websocket.send_text(
            json.dumps({
                "type": "ORCHESTRATION_COMPLETED",
                "graph": final_graph.model_dump(mode="json"),
            })
        )
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for case {case_id}")
    except Exception as e:
        logger.error(f"WebSocket error during orchestration streaming: {e}", exc_info=True)
        try:
            await websocket.send_text(
                json.dumps({
                    "type": "ORCHESTRATION_ERROR",
                    "error": str(e),
                })
            )
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
