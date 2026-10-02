from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CaseBase(BaseModel):
    title: str = Field(..., description="Short descriptive clinical title")
    chief_complaint: str = Field(..., description="Primary patient symptom or reason for visit")
    symptoms: List[str] = Field(default_factory=list)
    clinical_notes: Optional[str] = None
    priority: str = Field("routine", description="Priority level: routine, urgent, stat")


class CaseCreate(CaseBase):
    patient_id: str = Field(..., description="UUID of the associated patient")
    case_number: Optional[str] = Field(None, description="Optional custom case number, generated if omitted")


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    chief_complaint: Optional[str] = None
    symptoms: Optional[List[str]] = None
    clinical_notes: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None


class CaseResponse(CaseBase):
    id: str
    patient_id: str
    case_number: str
    status: str
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CaseDetailResponse(CaseResponse):
    patient_mrn: Optional[str] = None
    patient_name: Optional[str] = None
    asset_count: int = 0
