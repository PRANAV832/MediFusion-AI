from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class ClinicalEventCreate(BaseModel):
    event_type: str = Field(..., description="Type of clinical event: consultation, lab_result, imaging, prescription, admission, diagnosis")
    event_date: datetime = Field(default_factory=datetime.utcnow)
    summary: str = Field(..., description="Concise description or clinical observation")
    case_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ClinicalEventResponse(BaseModel):
    id: str
    patient_id: str
    case_id: Optional[str] = None
    event_type: str
    event_date: datetime
    summary: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_by: Optional[str] = None
    created_at: datetime
