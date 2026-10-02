from datetime import date
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class IngestTextRequest(BaseModel):
    """Request payload for direct clinical text / document intake."""
    patient_id: str = Field(..., description="Target patient UUID (mandatory server-side isolation)")
    content: str = Field(..., description="Raw clinical text or summary to ingest")
    filename: str = Field(default="clinical_note.txt", description="Document filename")
    document_type: str = Field(default="clinical_note", description="Type: discharge_summary, radiology_report, clinical_note, lab_report, prescription")
    case_id: Optional[str] = Field(default=None, description="Optional associated case UUID")
    document_id: Optional[str] = Field(default=None, description="Optional parent document UUID")
    event_date: Optional[str] = Field(default=None, description="Clinical event date (YYYY-MM-DD)")
    domain: str = Field(default="clinical", description="Specialty domain: cardiology, pulmonology, radiology, oncology, general")
    source_path: Optional[str] = Field(default=None, description="Origin path or storage URL")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary extra metadata")


class IngestResponse(BaseModel):
    patient_id: str
    filename: str
    document_type: str
    total_chunks: int
    chunks_created: int
    message: str


class EvidenceSearchRequest(BaseModel):
    """Search request with strict server-side patient scoping and temporal filtering."""
    patient_id: str = Field(..., description="Target patient UUID (MANDATORY for server-side patient isolation)")
    query: str = Field(..., description="Clinical inquiry or symptom query")
    case_id: Optional[str] = Field(default=None, description="Filter to specific case")
    domain: Optional[str] = Field(default=None, description="Filter to domain: cardiology, pulmonology, etc.")
    document_type: Optional[str] = Field(default=None, description="Filter to document type")
    top_k: int = Field(default=10, ge=1, le=50, description="Max evidence chunks to retrieve")
    match_threshold: float = Field(default=0.0, ge=0.0, le=1.0, description="Minimum cosine similarity")
    temporal_scope: Optional[str] = Field(default="all", description="Temporal scope filter: 'all' | 'current' | 'historical'")
    current_threshold_days: int = Field(default=30, ge=1, description="Days threshold distinguishing current encounter vs historical evidence")
    reference_date: Optional[str] = Field(default=None, description="Reference baseline date (YYYY-MM-DD)")


class RetrievedEvidenceItem(BaseModel):
    """A single retrieved evidence chunk with complete provenance and temporal context."""
    id: str
    patient_id: str
    document_id: Optional[str] = None
    case_id: Optional[str] = None
    content: str
    clean_content: Optional[str] = None
    document_type: str
    event_date: str
    page_number: int
    domain: str
    filename: str
    chunk_index: int
    source_path: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    similarity: float
    temporal_category: str = Field(default="HISTORICAL", description="'CURRENT' or 'HISTORICAL'")
    days_offset: Optional[int] = Field(default=None, description="Days elapsed between event_date and reference date")



class EvidenceSearchResponse(BaseModel):
    patient_id: str
    query: str
    total_retrieved: int
    evidence: List[RetrievedEvidenceItem]


class PatientKnowledgeChunk(BaseModel):
    id: str
    patient_id: str
    document_id: Optional[str] = None
    case_id: Optional[str] = None
    content: str
    clean_content: Optional[str] = None
    document_type: str
    event_date: str
    page_number: int
    domain: str
    filename: str
    chunk_index: int
    source_path: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str


class PatientKnowledgeResponse(BaseModel):
    patient_id: str
    total_chunks: int
    chunks: List[PatientKnowledgeChunk]
