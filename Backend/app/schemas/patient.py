from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class PatientBase(BaseModel):
    mrn: str = Field(..., description="Unique Medical Record Number")
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    blood_type: Optional[str] = None
    allergies: List[str] = Field(default_factory=list)
    chronic_conditions: List[str] = Field(default_factory=list)


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None


class PatientResponse(PatientBase):
    id: str
    assigned_clinician_id: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class PatientSummaryResponse(BaseModel):
    patient: PatientResponse
    total_cases: int
    total_events: int
    total_documents: int
    total_reports: int
    active_conditions: List[str]
    allergies: List[str]
    last_activity_date: Optional[datetime] = None
