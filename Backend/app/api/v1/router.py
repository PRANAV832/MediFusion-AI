from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    capabilities,
    cases,
    conflicts,
    evidence,
    gemini,
    health,
    models,
    orchestration,
    orchestration_graph,
    patients,
    rag,
    registry,
    reports,
    scheduler,
    council,
    sensitivity,
    explainability,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["System"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & Profiles"])
api_router.include_router(patients.router, prefix="/patients", tags=["Patients"])
api_router.include_router(cases.router, prefix="/cases", tags=["Cases"])
api_router.include_router(models.router, prefix="/models", tags=["Medical Models"])
api_router.include_router(registry.router, prefix="/registry", tags=["Model Registry"])
api_router.include_router(capabilities.router, prefix="/capabilities", tags=["Clinical Capabilities"])
api_router.include_router(orchestration.router, prefix="/orchestration", tags=["Model Orchestration"])
api_router.include_router(orchestration_graph.router, prefix="/orchestration-graph", tags=["Real-Time Orchestration Graph"])
api_router.include_router(scheduler.router, prefix="/scheduler", tags=["Resource Scheduler"])
api_router.include_router(rag.router, prefix="/rag", tags=["Patient-Centric RAG"])
api_router.include_router(gemini.router, prefix="/gemini", tags=["Gemini Evidence-Language Layer"])
api_router.include_router(evidence.router, prefix="/evidence", tags=["Canonical Evidence System"])
api_router.include_router(conflicts.router, prefix="/conflicts", tags=["Conflict Detection & Clinical Review"])
api_router.include_router(reports.router, prefix="/reports", tags=["Screening Reports & Clinical Intelligence"])
api_router.include_router(council.router, tags=["Model Council"])
api_router.include_router(sensitivity.router, tags=["Evidence Sensitivity"])
api_router.include_router(explainability.router, tags=["Imaging Explainability"])


