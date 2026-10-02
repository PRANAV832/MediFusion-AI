"""
MediFusion AI — Phase 11 Canonical Evidence Schemas
Defines core EvidenceItem, EvidenceLink, Finding, and ProvenanceRecord models
with strict provenance hierarchy and anti-self-referencing rules.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class EvidenceType(str, Enum):
    MODEL_FINDING = "MODEL_FINDING"
    PATIENT_RECORD = "PATIENT_RECORD"
    TRUSTED_KNOWLEDGE = "TRUSTED_KNOWLEDGE"
    GENERATED_SYNTHESIS = "GENERATED_SYNTHESIS"


class EvidenceLinkType(str, Enum):
    SUPPORTS = "SUPPORTS"
    CONTRADICTS = "CONTRADICTS"
    CONTEXTUALIZES = "CONTEXTUALIZES"
    DERIVED_FROM = "DERIVED_FROM"


class FindingSeverity(str, Enum):
    NORMAL = "NORMAL"
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class FindingStatus(str, Enum):
    DETECTED = "DETECTED"
    RULED_OUT = "RULED_OUT"
    EQUIVOCAL = "EQUIVOCAL"
    PENDING_REVIEW = "PENDING_REVIEW"


class ProvenanceRecord(BaseModel):
    """
    Immutable provenance chain recording the precise historical origin of evidence.
    Provenance Hierarchies:
      - MODEL_FINDING: model -> model run -> source asset
      - PATIENT_RECORD: document -> page -> chunk
      - TRUSTED_KNOWLEDGE: source -> document/chunk
      - GENERATED_SYNTHESIS: Gemini -> supporting evidence IDs
    """
    evidence_type: EvidenceType

    # Model Finding Provenance (model -> model run -> source asset)
    model_id: Optional[str] = None
    model_name: Optional[str] = None
    model_run_id: Optional[str] = None
    source_asset_id: Optional[str] = None
    source_asset_filename: Optional[str] = None
    modality: Optional[str] = None

    # Patient Record Provenance (document -> page -> chunk)
    document_id: Optional[str] = None
    document_filename: Optional[str] = None
    page_number: Optional[int] = None
    chunk_id: Optional[str] = None
    chunk_index: Optional[int] = None
    domain: Optional[str] = None
    event_date: Optional[str] = None

    # Trusted Knowledge Provenance (source -> document/chunk)
    source_name: Optional[str] = None
    document_title: Optional[str] = None
    citation_reference: Optional[str] = None

    # Generated Synthesis Provenance (Gemini -> supporting evidence IDs)
    generator: Optional[str] = None
    supporting_evidence_ids: List[str] = Field(default_factory=list)

    # Computed/Formatted Trace Path
    trace_path: List[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def populate_trace_path(self) -> "ProvenanceRecord":
        """Compute the canonical hierarchical trace path based on evidence type."""
        if not self.trace_path:
            if self.evidence_type == EvidenceType.MODEL_FINDING:
                self.trace_path = [
                    self.model_name or self.model_id or "Specialized Medical Model",
                    f"Model Run #{self.model_run_id[:8]}" if self.model_run_id else "Model Run",
                    self.source_asset_filename or self.source_asset_id or "Source Asset",
                ]
            elif self.evidence_type == EvidenceType.PATIENT_RECORD:
                self.trace_path = [
                    self.document_filename or self.document_id or "Patient Document",
                    f"Page {self.page_number}" if self.page_number is not None else "Page 1",
                    f"Chunk #{self.chunk_index}" if self.chunk_index is not None else "Chunk",
                ]
            elif self.evidence_type == EvidenceType.TRUSTED_KNOWLEDGE:
                self.trace_path = [
                    self.source_name or "Trusted Clinical Knowledge",
                    self.document_title or self.citation_reference or "Clinical Guideline",
                ]
            elif self.evidence_type == EvidenceType.GENERATED_SYNTHESIS:
                self.trace_path = [
                    self.generator or "Gemini Evidence-Language Layer",
                    f"{len(self.supporting_evidence_ids)} Supporting Evidence Items",
                ]
        return self


class EvidenceItem(BaseModel):
    """
    Canonical atomic unit of medical evidence across specialized models,
    patient records, clinical guidelines, and synthesis.
    """
    id: str = Field(..., description="Unique canonical evidence identifier")
    case_id: Optional[str] = None
    patient_id: str = Field(..., description="Target patient UUID")
    evidence_type: EvidenceType = Field(..., description="Type of canonical evidence")
    title: str = Field(..., description="Short descriptive label")
    summary: str = Field(..., description="Detailed clinical summary or excerpt")
    content: Optional[str] = Field(None, description="Full raw content or excerpt")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence score if applicable")
    modality: Optional[str] = Field(None, description="Modality (chest_xray, ecg, clinical_note, etc.)")
    event_date: Optional[str] = Field(None, description="Clinical occurrence date")
    provenance: ProvenanceRecord
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="after")
    def validate_anti_hallucination_and_confidence(self) -> "EvidenceItem":
        """
        Enforce anti-hallucination constraint:
        GENERATED_SYNTHESIS must not have an invented confidence score.
        """
        if self.evidence_type == EvidenceType.GENERATED_SYNTHESIS and self.confidence is not None:
            # Prevent fake confidence score generation for synthesis
            self.confidence = None
        return self


class EvidenceLink(BaseModel):
    """
    Typed directed relationship between findings/syntheses and supporting evidence items.
    """
    id: str = Field(..., description="Unique link identifier")
    case_id: Optional[str] = None
    source_id: str = Field(..., description="ID of source item (Finding or Synthesis)")
    source_type: str = Field(..., description="Source entity type (FINDING or SYNTHESIS)")
    target_evidence_id: str = Field(..., description="ID of supporting EvidenceItem")
    target_evidence_type: EvidenceType = Field(..., description="Type of target evidence")
    link_type: EvidenceLinkType = Field(default=EvidenceLinkType.SUPPORTS)
    rationale: Optional[str] = Field(None, description="Clinical justification for link")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Finding(BaseModel):
    """
    Clinically significant diagnostic observation or flagged condition
    derived from specialized models, patient history, or clinical synthesis.
    """
    id: str = Field(..., description="Unique canonical finding identifier")
    case_id: str
    patient_id: str
    label: str = Field(..., description="Clinical pathology or observation name")
    severity: FindingSeverity = Field(default=FindingSeverity.MODERATE)
    status: FindingStatus = Field(default=FindingStatus.DETECTED)
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    source_evidence_type: EvidenceType
    primary_evidence_id: Optional[str] = None
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    provenance: ProvenanceRecord
    clinical_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CanonicalCaseEvidenceGraph(BaseModel):
    """
    Complete canonical evidence graph for a clinical case.
    """
    case_id: str
    patient_id: str
    evidence_items: List[EvidenceItem] = Field(default_factory=list)
    findings: List[Finding] = Field(default_factory=list)
    links: List[EvidenceLink] = Field(default_factory=list)
    stats: Dict[str, int] = Field(default_factory=dict)


def validate_canonical_support(
    synthesis_item: EvidenceItem,
    evidence_pool: Dict[str, EvidenceItem],
) -> bool:
    """
    CRITICAL RULE ENFORCEMENT:
    GENERATED_SYNTHESIS cannot support itself.
    It must point to actual evidence (MODEL_FINDING, PATIENT_RECORD, TRUSTED_KNOWLEDGE).

    Raises:
        ValueError if the rule is violated.
    """
    if synthesis_item.evidence_type != EvidenceType.GENERATED_SYNTHESIS:
        return True

    supporting_ids = synthesis_item.provenance.supporting_evidence_ids
    if not supporting_ids:
        raise ValueError(
            "CRITICAL_RULE_VIOLATION: GENERATED_SYNTHESIS cannot support itself. "
            "It must point to actual evidence."
        )

    # Check for direct self-reference
    if synthesis_item.id in supporting_ids:
        raise ValueError(
            f"CRITICAL_RULE_VIOLATION: GENERATED_SYNTHESIS (ID: {synthesis_item.id}) "
            "cannot support itself (self-reference detected)."
        )

    # Check that at least one reachable supporting evidence item is an actual non-synthesis evidence item
    visited = set()
    actual_evidence_found = False

    def traverse(current_id: str, depth: int = 0):
        nonlocal actual_evidence_found
        if depth > 10 or current_id in visited:
            return
        visited.add(current_id)

        target = evidence_pool.get(current_id)
        if not target:
            return

        if target.evidence_type in (
            EvidenceType.MODEL_FINDING,
            EvidenceType.PATIENT_RECORD,
            EvidenceType.TRUSTED_KNOWLEDGE,
        ):
            actual_evidence_found = True
            return

        if target.evidence_type == EvidenceType.GENERATED_SYNTHESIS:
            for sub_id in target.provenance.supporting_evidence_ids:
                if sub_id != current_id:
                    traverse(sub_id, depth + 1)

    for sup_id in supporting_ids:
        traverse(sup_id)

    if not actual_evidence_found:
        raise ValueError(
            "CRITICAL_RULE_VIOLATION: GENERATED_SYNTHESIS cannot support itself. "
            "It must point to actual evidence (MODEL_FINDING, PATIENT_RECORD, or TRUSTED_KNOWLEDGE). "
            "Circular or synthesis-only support loops are forbidden."
        )

    return True
