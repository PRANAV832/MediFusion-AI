import pytest
from datetime import datetime
from pydantic import ValidationError

from app.schemas.report import (
    CaseContextSection,
    ClinicalIntelligenceSummary,
    ConflictSectionItem,
    CrossModalObservationItem,
    EvidenceLabel,
    GeneratedSynthesisSection,
    InputModalityItem,
    ModelFindingItem,
    PatientContextSection,
    PatientHistoryItem,
    ProvenanceTraceItem,
    RetrievedEvidenceItem,
    ReviewNotesSection,
    ReviewStatusSection,
    ScreeningReportSignOffRequest,
    SelectedModelItem,
    UncertaintySection,
)
from app.services.screening_report import ScreeningReportService


def create_sample_summary(title: str = "Clinical Intelligence Summary") -> ClinicalIntelligenceSummary:
    now = datetime.utcnow()
    return ClinicalIntelligenceSummary(
        id="rep-test-123",
        title=title,
        report_type="clinical_screening",
        patient_id="pat-456",
        case_id="case-789",
        status="preliminary",
        review_status="REVIEW_REQUIRED",
        uncertainty_level="MODERATE",
        created_at=now,
        updated_at=now,
        patient_context=PatientContextSection(
            patient_id="pat-456",
            mrn="MRN-10029",
            full_name="Eleanor Vance",
            age=58,
            gender="Female",
            blood_type="A+",
            primary_condition="Chronic Obstructive Pulmonary Disease",
            allergies=["Penicillin"],
            active_medications=["Albuterol MDI", "Lisinopril 10mg"],
            recent_vitals={"bp": "128/82", "spo2": 94, "hr": 88},
        ),
        case_context=CaseContextSection(
            case_id="case-789",
            case_number="CASE-2026-0042",
            title="Acute Dyspnea and Productive Cough",
            status="in_review",
            priority="urgent",
            chief_complaint="Worsening shortness of breath over 48 hours",
            symptoms=["dyspnea", "productive cough", "low-grade fever"],
            clinical_notes="Patient presents with acute exacerbation symptoms.",
            admission_date=now,
        ),
        input_modalities=[
            InputModalityItem(
                asset_id="ast-cxr-1",
                filename="chest_pa_view.png",
                modality="chest_xray",
                mime_type="image/png",
                size_bytes=1048576,
                checksum_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                quality_status="VERIFIED",
            ),
            InputModalityItem(
                asset_id="ast-ecg-1",
                filename="ecg_lead_ii.png",
                modality="ecg",
                mime_type="image/png",
                size_bytes=524288,
                checksum_sha256="cca92d4b8e0e64c3983d987df577b212f458e0a1f7c327ff7e80f2d59cf4032d",
                quality_status="VERIFIED",
            ),
        ],
        selected_models=[
            SelectedModelItem(
                model_id="mod-densenet121",
                name="TorchXRayVision DenseNet-121",
                version="1.0.0",
                capability="chest_xray_pathology",
                modality="chest_xray",
                operating_threshold=0.50,
                execution_state="COMPLETED",
                device="cpu",
                runtime_seconds=0.42,
            ),
        ],
        model_findings=[
            ModelFindingItem(
                finding_id="fnd-1",
                evidence_label=EvidenceLabel.MODEL_FINDING,
                capability="chest_xray_pathology",
                pathology="Consolidation",
                probability=0.742,
                threshold=0.50,
                is_positive=True,
                severity="high",
                source_asset_id="ast-cxr-1",
                model_name="TorchXRayVision DenseNet-121",
            ),
            ModelFindingItem(
                finding_id="fnd-2",
                evidence_label=EvidenceLabel.MODEL_FINDING,
                capability="chest_xray_pathology",
                pathology="Pneumothorax",
                probability=0.082,
                threshold=0.50,
                is_positive=False,
                severity="low",
                source_asset_id="ast-cxr-1",
                model_name="TorchXRayVision DenseNet-121",
            ),
        ],
        patient_history=[
            PatientHistoryItem(
                record_id="hist-1",
                evidence_label=EvidenceLabel.PATIENT_RECORD,
                category="chronic_condition",
                description="Documented severe COPD with previous hospitalizations in 2024.",
                verified_by_clinician=True,
            ),
        ],
        retrieved_evidence=[
            RetrievedEvidenceItem(
                chunk_id="chk-101",
                evidence_label=EvidenceLabel.PATIENT_RECORD,
                document_title="Discharge_Summary_2024.pdf",
                document_type="discharge_summary",
                page_number=2,
                chunk_index=3,
                similarity_score=0.884,
                content_excerpt="Discharged on supplemental oxygen and bronchodilators following lower lobe infiltrate.",
            ),
        ],
        cross_modal_observations=[
            CrossModalObservationItem(
                observation_id="cmo-1",
                title="Consolidation correlated with acute tachypnea",
                modalities_involved=["chest_xray", "ecg"],
                correlation_type="CORROBORATING",
                clinical_narrative="Right lower lobe consolidation on PA radiograph coincides with sinus tachycardia on ECG.",
                significance_level="HIGH",
            ),
        ],
        conflicts=[
            ConflictSectionItem(
                conflict_id="cnf-1",
                conflict_type="MODEL_VS_HISTORY",
                severity="HIGH",
                status="OPEN",
                source_a_label="Model Inference (DenseNet-121)",
                source_a_claim="Clear lung fields / no infiltrate",
                source_b_label="Historical Discharge Summary",
                source_b_claim="Documented chronic fibrotic changes in right base",
                clinical_significance="Potential masking of acute infiltrate by preexisting fibrosis.",
            ),
        ],
        uncertainty=UncertaintySection(
            overall_uncertainty_tier="MODERATE",
            model_calibration_notes=["Consolidation score 0.74 exceeds operating threshold 0.50."],
            missing_modalities=["lab_report"],
            image_quality_caveats=["Verified SHA-256 integrity, standard contrast resolution."],
            evidence_completeness_ratio=0.75,
            explicit_data_gaps=["Complete arterial blood gas panel not submitted."],
        ),
        review_status_details=ReviewStatusSection(
            review_state="REVIEW_REQUIRED",
            urgency_tier="URGENT",
            requires_specialist_consult=True,
            recommended_specialty="Pulmonology",
            is_signed_off=False,
        ),
        provenance=[
            ProvenanceTraceItem(
                trace_id="trc-1",
                target_finding="Consolidation (P=0.742)",
                source_origin="Model Run: TorchXRayVision DenseNet-121",
                asset_reference="chest_pa_view.png",
                sha256_verification="e3b0c44298fc1c14",
                timestamp=now,
            ),
        ],
        generated_synthesis=GeneratedSynthesisSection(
            synthesis_id="syn-1",
            evidence_label=EvidenceLabel.GENERATED_SYNTHESIS,
            executive_summary="Screening suggests right basilar consolidation in patient with chronic COPD history.",
            detailed_synthesis="Multimodal analysis combines radiographic consolidation detection with patient dyspnea intake notes.",
            supporting_evidence_ids=["fnd-1", "chk-101"],
            clinical_correlations=["Consolidation correlates with prior right base vulnerability."],
            targeted_physician_questions=["Is supplemental oxygen therapy indicated based on 94% SpO2?"],
            generated_at=now,
        ),
        review_notes=ReviewNotesSection(
            notes_id="not-1",
            clinician_comments=None,
            diagnostic_disposition=None,
            sign_off_status="DRAFT",
        ),
    )


def test_screening_report_title_validation():
    """Verify that title 'Final Diagnosis' is strictly prohibited while 'Screening Report' is valid."""
    # Valid titles
    s1 = create_sample_summary(title="Screening Report")
    assert s1.title == "Screening Report"

    s2 = create_sample_summary(title="Clinical Intelligence Summary")
    assert s2.title == "Clinical Intelligence Summary"

    # Prohibited title
    with pytest.raises(ValidationError) as excinfo:
        create_sample_summary(title="Patient Final Diagnosis Report")
    assert "prohibited" in str(excinfo.value).lower()
    assert "final diagnosis" in str(excinfo.value).lower()


def test_fourteen_mandatory_sections_present():
    """Ensure all 14 required sections exist and are populated with correct types."""
    summary = create_sample_summary()

    # 1. Patient Context
    assert summary.patient_context.mrn == "MRN-10029"
    assert summary.patient_context.full_name == "Eleanor Vance"

    # 2. Case Context
    assert summary.case_context.priority == "urgent"
    assert summary.case_context.chief_complaint != ""

    # 3. Input Modalities
    assert len(summary.input_modalities) == 2
    assert summary.input_modalities[0].quality_status == "VERIFIED"

    # 4. Selected Models
    assert len(summary.selected_models) == 1
    assert summary.selected_models[0].operating_threshold == 0.50

    # 5. Model Findings (with MODEL FINDING label)
    assert len(summary.model_findings) == 2
    assert summary.model_findings[0].evidence_label == EvidenceLabel.MODEL_FINDING
    assert summary.model_findings[0].pathology == "Consolidation"

    # 6. Patient History (with PATIENT RECORD label)
    assert len(summary.patient_history) == 1
    assert summary.patient_history[0].evidence_label == EvidenceLabel.PATIENT_RECORD

    # 7. Retrieved Evidence (with PATIENT RECORD label)
    assert len(summary.retrieved_evidence) == 1
    assert summary.retrieved_evidence[0].evidence_label == EvidenceLabel.PATIENT_RECORD
    assert summary.retrieved_evidence[0].page_number == 2

    # 8. Cross-Modal Observations
    assert len(summary.cross_modal_observations) == 1
    assert summary.cross_modal_observations[0].correlation_type == "CORROBORATING"

    # 9. Conflicts
    assert len(summary.conflicts) == 1
    assert summary.conflicts[0].conflict_type == "MODEL_VS_HISTORY"

    # 10. Uncertainty (never hidden, never fake score)
    assert summary.uncertainty.overall_uncertainty_tier == "MODERATE"
    assert "lab_report" in summary.uncertainty.missing_modalities
    assert len(summary.uncertainty.explicit_data_gaps) > 0
    assert "screening report does not constitute a definitive diagnostic finding" in summary.uncertainty.clinical_disclaimer.lower()

    # 11. Review Status
    assert summary.review_status_details.review_state == "REVIEW_REQUIRED"
    assert summary.review_status_details.urgency_tier == "URGENT"

    # 12. Provenance
    assert len(summary.provenance) == 1
    assert summary.provenance[0].trace_id == "trc-1"

    # 13. Generated Synthesis (with GENERATED SYNTHESIS label)
    assert summary.generated_synthesis.evidence_label == EvidenceLabel.GENERATED_SYNTHESIS
    assert len(summary.generated_synthesis.supporting_evidence_ids) == 2

    # 14. Review Notes
    assert summary.review_notes.sign_off_status == "DRAFT"


def test_markdown_export_generation():
    """Verify that export_screening_report_markdown generates all 14 numbered sections."""
    service = ScreeningReportService(db_client=None)
    summary = create_sample_summary()
    md = service.export_screening_report_markdown(summary)

    # Check key disclaimer & headers
    assert "NOT A FINAL DIAGNOSIS" in md
    assert "## 1. Patient Context" in md
    assert "## 2. Case Context" in md
    assert "## 3. Input Modalities" in md
    assert "## 4. Selected Models" in md
    assert "## 5. Model Findings [EVIDENCE: MODEL FINDING]" in md
    assert "## 6. Patient History [EVIDENCE: PATIENT RECORD]" in md
    assert "## 7. Retrieved Evidence [EVIDENCE: PATIENT RECORD / TRUSTED KNOWLEDGE]" in md
    assert "## 8. Cross-Modal Observations" in md
    assert "## 9. Conflicts & Discrepancies" in md
    assert "## 10. Uncertainty & Data Gaps" in md
    assert "## 11. Review Status" in md
    assert "## 12. Provenance Audit Trace" in md
    assert "## 13. Generated Synthesis [EVIDENCE: GENERATED SYNTHESIS]" in md
    assert "## 14. Review Notes & Attending Sign-Off" in md
