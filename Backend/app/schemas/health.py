from datetime import datetime
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field("ok", description="Current backend service status")
    environment: str = Field(..., description="Active operating environment")
    version: str = Field(..., description="Service version")
    timestamp: datetime = Field(..., description="UTC server timestamp")
    uptime_seconds: float = Field(..., description="Server uptime in seconds")
