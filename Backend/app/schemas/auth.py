from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class ProfileResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "clinician"
    organization: Optional[str] = "MediFusion Health System"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AuthUserResponse(BaseModel):
    id: str
    email: EmailStr
    role: str
    profile: ProfileResponse


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    organization: Optional[str] = None
    role: Optional[str] = Field(None, description="Clinician role designation")
