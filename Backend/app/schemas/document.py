from datetime import date, datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class DocumentCreate(BaseModel):
    title: str = Field(..., description="Document name, e.g., 'Discharge Summary - Cardiology'")
    document_type: str = Field(..., description="discharge_summary, lab_report, radiology_report, prescription, clinical_note, referral")
    document_date: date = Field(default_factory=date.today)
    department: Optional[str] = "General Medicine"
    author_name: Optional[str] = None
    summary: Optional[str] = None
    file_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class DocumentResponse(BaseModel):
    id: str
    patient_id: str
    title: str
    document_type: str
    document_date: date
    department: Optional[str] = None
    author_name: Optional[str] = None
    summary: Optional[str] = None
    file_url: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
