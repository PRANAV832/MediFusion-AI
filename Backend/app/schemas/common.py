from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    message: str = Field(..., description="Human-readable error description")
    type: str = Field(..., description="Error category or class name")
    details: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Structured error context")


class ErrorResponse(BaseModel):
    error: ErrorDetail
