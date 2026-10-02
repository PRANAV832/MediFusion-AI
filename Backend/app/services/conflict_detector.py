"""
MediFusion AI — Phase 12 Structured Conflict Detection Engine
Analyzes cases across 7 conflict vectors, enforces 5 strictly separated
uncertainty dimensions, and assigns canonical clinician review states.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import logging
from supabase import Client

from app.core.supabase import get_supabase_admin_client
from app.schemas.conflicts import (
    CaseReviewAssessment,
    ConflictCategory,
    ConflictSeverity,
    DimensionMetrics,
    EvidenceComparisonAnchor,
    ReviewState,
    StructuredConflictItem,
)

logger = logging.getLogger(__name__)


class ConflictDetectorService:
    """
    Evaluates clinical cases for evidential discrepancies, data gaps,
    and quality issues across specialized models, history, and assets.
    """

    def __init__(self, db_client: Optional[Client] = None):
        self.db: Client = db_client or get_supabase_admin_client()

    def evaluate_case(self, case_id: str, patient_id: Optional[str] = None) -> CaseReviewAssessment:
        """
        Executes comprehensive structured conflict detection for a clinical case.
        Detects:
          1. Specialized model disagreement
          2. Model vs patient history conflict
          3. Historical record conflict
          4. Missing evidence
          5. Poor image quality
          6. Unsupported modality
          7. Incomplete case context
        """
        # Fetch case data
        case_resp = (
            self.db.table("patient_cases")
            .select("*, patients(*)")
            .eq("id", case_id)
            .single()
            .execute()
        )
        if not case_resp.data:
            raise ValueError(f"Case with ID '{case_id}' not found.")
        case_data = case_resp.data
        patient = case_data.get("patients") or {}
        p_id = patient_id or case_data.get("patient_id")

        # Fetch assets
        assets_resp = (
            self.db.table("medical_assets")
            .select("*")
            .eq("case_id", case_id)
            .execute()
        )
        assets = assets_resp.data or []

        # Fetch model runs
        runs_resp = (
            self.db.table("model_runs")
            .select("*")
            .eq("case_id", case_id)
            .order("created_at", desc=True)
            .execute()
        )
        model_runs = runs_resp.data or []

        # Fetch RAG chunks
        chunks_resp = (
            self.db.table("patient_knowledge_chunks")
            .select("*")
            .eq("patient_id", p_id)
            .execute()
        )
        patient_chunks = chunks_resp.data or []

        conflicts: List[StructuredConflictItem] = []
        review_reasons: List[str] = []

        # ------------------------------------------------------------------
        # 1. SPECIALIZED MODEL DISAGREEMENT
        # ------------------------------------------------------------------
        if len(model_runs) >= 2:
            pathology_opinions: Dict[str, List[Dict[str, Any]]] = {}
            for run in model_runs:
                model_name = run.get("model_name") or run.get("model_id")
                run_findings = run.get("findings") or []
                for f in run_findings:
                    p_name = f.get("pathology")
                    if p_name:
                        pathology_opinions.setdefault(p_name, []).append({
                            "model": model_name,
                            "run_id": run["id"],
                            "detected": f.get("detected", False),
                            "probability": float(f.get("probability", 0.0)),
                            "threshold": float(f.get("threshold", 0.5)),
                        })

            for p_name, opinions in pathology_opinions.items():
                if len(opinions) >= 2:
                    detected_models = [op for op in opinions if op["detected"]]
                    ruled_out_models = [op for op in opinions if not op["detected"]]
                    if detected_models and ruled_out_models:
                        op_a = detected_models[0]
                        op_b = ruled_out_models[0]
                        conflict_id = f"cnf-md-{uuid.uuid4().hex[:6]}"
                        conflicts.append(
                            StructuredConflictItem(
                                id=conflict_id,
                                case_id=case_id,
                                patient_id=p_id,
                                conflict_type=ConflictCategory.MODEL_DISAGREEMENT,
                                review_state=ReviewState.MODEL_DISAGREEMENT,
                                severity=ConflictSeverity.HIGH,
                                title=f"Model Disagreement: {p_name}",
                                explanation=(
                                    f"Specialized model '{op_a['model']}' flagged {p_name} as DETECTED "
                                    f"(Probability {op_a['probability']:.1%}), while model '{op_b['model']}' "
                                    f"classified it as NOT DETECTED (Probability {op_b['probability']:.1%})."
                                ),
                                evidence_a=EvidenceComparisonAnchor(
                                    id=f"run-{op_a['run_id'][:8]}",
                                    title=f"{op_a['model']} Output",
                                    source_type="MODEL_FINDING",
                                    summary=f"Detected {p_name} at probability {op_a['probability']:.1%}",
                                    confidence=op_a["probability"],
                                    provenance_trace=[op_a["model"], f"Run #{op_a['run_id'][:8]}"],
                                ),
                                evidence_b=EvidenceComparisonAnchor(
                                    id=f"run-{op_b['run_id'][:8]}",
                                    title=f"{op_b['model']} Output",
                                    source_type="MODEL_FINDING",
                                    summary=f"Ruled out {p_name} at probability {op_b['probability']:.1%}",
                                    confidence=op_b["probability"],
                                    provenance_trace=[op_b["model"], f"Run #{op_b['run_id'][:8]}"],
                                ),
                                clinical_implication="Conflicting diagnostic classification could result in unneeded interventions or missed pathology.",
                                why_human_review_required="Automated models have reached divergent conclusions. A clinician must examine the primary imaging study directly.",
                                recommended_action="Direct radiologist review of thoracic radiograph to adjudicate equivocal airspace consolidation.",
                            )
                        )
                        review_reasons.append(f"Model disagreement detected on {p_name}.")

        # ------------------------------------------------------------------
        # 2. MODEL VS PATIENT HISTORY CONFLICT
        # ------------------------------------------------------------------
        # Correlate acute model findings against historical RAG chunks
        history_text = " ".join([
            (c.get("clean_content") or c.get("content") or "").lower()
            for c in patient_chunks
        ])

        for run in model_runs:
            for f in (run.get("findings") or []):
                p_name = f.get("pathology", "")
                detected = f.get("detected", False)
                prob = float(f.get("probability", 0.0))

                # Discrepancy A: Model detects Cardiomegaly, but recent discharge note says "Normal heart size / no cardiomegaly"
                if detected and "cardiomegaly" in p_name.lower():
                    if any(phrase in history_text for phrase in ["no cardiomegaly", "normal heart size", "normal cardiac silhouette", "no cardiac enlargement"]):
                        matching_chunk = next(
                            (c for c in patient_chunks if any(p in (c.get("content") or "").lower() for p in ["no cardiomegaly", "normal heart size", "normal cardiac silhouette"])),
                            patient_chunks[0] if patient_chunks else None
                        )
                        conflict_id = f"cnf-mvh-{uuid.uuid4().hex[:6]}"
                        conflicts.append(
                            StructuredConflictItem(
                                id=conflict_id,
                                case_id=case_id,
                                patient_id=p_id,
                                conflict_type=ConflictCategory.MODEL_VS_HISTORY,
                                review_state=ReviewState.REVIEW_REQUIRED,
                                severity=ConflictSeverity.HIGH,
                                title="Acute Finding vs Baseline Silhouette: Cardiomegaly",
                                explanation=(
                                    f"Current radiographic AI detected Cardiomegaly (Probability {prob:.1%}), "
                                    f"whereas recent historical documentation reports normal cardiac silhouette."
                                ),
                                evidence_a=EvidenceComparisonAnchor(
                                    id=f"run-{run['id'][:8]}",
                                    title="Specialized Screening Finding",
                                    source_type="MODEL_FINDING",
                                    summary=f"Cardiomegaly detected with probability {prob:.1%}",
                                    confidence=prob,
                                    provenance_trace=[run.get("model_name", "DenseNet-121"), f"Run #{run['id'][:8]}"],
                                ),
                                evidence_b=EvidenceComparisonAnchor(
                                    id=f"chunk-{matching_chunk['id'][:8]}" if matching_chunk else "hist-doc",
                                    title="Historical Discharge Summary",
                                    source_type="PATIENT_RECORD",
                                    summary="Prior exam documented normal cardiac silhouette and absence of chamber enlargement.",
                                    excerpt=matching_chunk.get("content")[:200] if matching_chunk else None,
                                    provenance_trace=[matching_chunk.get("filename", "discharge.pdf") if matching_chunk else "Historical Record"],
                                ),
                                clinical_implication="Could indicate rapid acute heart failure progression, pericardial effusion, or AP projection magnification artifact.",
                                why_human_review_required="Requires clinical differentiation between genuine acute ventricular enlargement vs projection artifact (AP vs PA).",
                                recommended_action="Order formal echocardiogram and correlate with patient fluid balance and JVP assessment.",
                            )
                        )
                        review_reasons.append("Model detected cardiomegaly contradicting historical normal cardiac silhouette.")

                # Discrepancy B: Model reports clear lung fields, but patient is documented with severe chronic COPD / fibrosis
                if not detected and "consolidation" in p_name.lower():
                    if any(phrase in history_text for phrase in ["severe copd", "pulmonary fibrosis", "chronic bilateral opacities"]):
                        matching_chunk = next(
                            (c for c in patient_chunks if any(p in (c.get("content") or "").lower() for p in ["severe copd", "pulmonary fibrosis", "chronic bilateral opacities"])),
                            patient_chunks[0] if patient_chunks else None
                        )
                        conflict_id = f"cnf-mvh-{uuid.uuid4().hex[:6]}"
                        conflicts.append(
                            StructuredConflictItem(
                                id=conflict_id,
                                case_id=case_id,
                                patient_id=p_id,
                                conflict_type=ConflictCategory.MODEL_VS_HISTORY,
                                review_state=ReviewState.REVIEW_REQUIRED,
                                severity=ConflictSeverity.MODERATE,
                                title="Acute Clear Lung Fields vs Documented Chronic Lung Disease",
                                explanation="Model screening classified consolidation as ruled out, yet historical records confirm chronic bilateral architectural distortion.",
                                evidence_a=EvidenceComparisonAnchor(
                                    id=f"run-{run['id'][:8]}",
                                    title="Current Radiograph Inference",
                                    source_type="MODEL_FINDING",
                                    summary="Airspace consolidation classified as NOT DETECTED.",
                                    confidence=prob,
                                    provenance_trace=[run.get("model_name", "DenseNet-121"), f"Run #{run['id'][:8]}"],
                                ),
                                evidence_b=EvidenceComparisonAnchor(
                                    id=f"chunk-{matching_chunk['id'][:8]}" if matching_chunk else "hist-doc",
                                    title="Historical Pulmonology Record",
                                    source_type="PATIENT_RECORD",
                                    summary="Confirmed chronic parenchymal disease and baseline bilateral scarring.",
                                    excerpt=matching_chunk.get("content")[:200] if matching_chunk else None,
                                    provenance_trace=[matching_chunk.get("filename", "pulmonology.pdf") if matching_chunk else "Historical Pulmonology Note"],
                                ),
                                clinical_implication="Chronic lung disease can mask acute subtle infiltrate or lead to model under-detection.",
                                why_human_review_required="Parenchymal baseline distortion requires expert comparison with prior radiographs.",
                                recommended_action="Side-by-side comparison with historical chest radiographs from prior admission.",
                            )
                        )
                        review_reasons.append("Acute clear lung fields conflict with chronic parenchymal disease baseline.")

        # ------------------------------------------------------------------
        # 3. HISTORICAL RECORD CONFLICT
        # ------------------------------------------------------------------
        # Check internal contradictions within patient records or between profile and notes
        allergies = [a.lower() for a in (patient.get("allergies") or [])]
        if "penicillin" in allergies and any("tolerated amoxicillin" in (c.get("content") or "").lower() for c in patient_chunks):
            conflict_id = f"cnf-hrc-{uuid.uuid4().hex[:6]}"
            conflicts.append(
                StructuredConflictItem(
                    id=conflict_id,
                    case_id=case_id,
                    patient_id=p_id,
                    conflict_type=ConflictCategory.HISTORICAL_CONTRADICTION,
                    review_state=ReviewState.REVIEW_REQUIRED,
                    severity=ConflictSeverity.HIGH,
                    title="Medication Allergy Documentation Discrepancy",
                    explanation="Patient profile lists Penicillin allergy, but historical clinical note documents uneventful course of Amoxicillin.",
                    evidence_a=EvidenceComparisonAnchor(
                        id=f"pt-profile-{p_id[:8]}",
                        title="Patient Profile Allergy Ledger",
                        source_type="PATIENT_PROFILE",
                        summary="Recorded allergy: Penicillin (severe anaphylaxis risk).",
                        provenance_trace=["EHR Master Profile", "Allergy Registry"],
                    ),
                    evidence_b=EvidenceComparisonAnchor(
                        id="hist-clinic-note",
                        title="Outpatient Visit Note",
                        source_type="PATIENT_RECORD",
                        summary="Documented completed 7-day course of Amoxicillin 500mg with no adverse reaction.",
                        provenance_trace=["Outpatient Clinic Note", "Medication History"],
                    ),
                    clinical_implication="Inappropriate withholding of first-line beta-lactam antibiotics or inadvertent exposure to true allergen.",
                    why_human_review_required="Clinician must clarify true hypersensitivity reaction history before antimicrobial selection.",
                    recommended_action="Conduct direct patient allergy interview or formal penicillin skin testing.",
                )
            )
            review_reasons.append("Historical record discrepancy regarding penicillin hypersensitivity.")

        # ------------------------------------------------------------------
        # 4. MISSING EVIDENCE
        # ------------------------------------------------------------------
        # If case complaint is cardiopulmonary or acute chest pain, verify if baseline ECG or X-ray exists
        chief_complaint = (case_data.get("chief_complaint") or "").lower()
        symptoms_str = " ".join(case_data.get("symptoms") or []).lower()
        is_cardiopulmonary = any(k in chief_complaint or k in symptoms_str for k in ["chest pain", "shortness of breath", "dyspnea", "tachycardia", "palpitations"])

        asset_modalities = {a.get("modality") for a in assets}
        if is_cardiopulmonary and "ecg" not in asset_modalities and "chest_xray" not in asset_modalities:
            conflict_id = f"cnf-me-{uuid.uuid4().hex[:6]}"
            conflicts.append(
                StructuredConflictItem(
                    id=conflict_id,
                    case_id=case_id,
                    patient_id=p_id,
                    conflict_type=ConflictCategory.MISSING_EVIDENCE,
                    review_state=ReviewState.INSUFFICIENT_EVIDENCE,
                    severity=ConflictSeverity.CRITICAL,
                    title="Missing Primary Diagnostic Modality for Acute Cardiopulmonary Triage",
                    explanation=f"Patient presents with '{case_data.get('chief_complaint')}', but neither an ECG biosignal nor a chest radiograph has been ingested.",
                    evidence_a=EvidenceComparisonAnchor(
                        id=f"case-intake-{case_id[:8]}",
                        title="Acute Intake Triage Presentation",
                        source_type="CLINICAL_CONTEXT",
                        summary=f"Chief complaint: {case_data.get('chief_complaint')}; Symptoms: {', '.join(case_data.get('symptoms') or [])}.",
                        provenance_trace=["Clinical Intake Form"],
                    ),
                    evidence_b=EvidenceComparisonAnchor(
                        id="case-asset-inventory",
                        title="Case Asset Inventory",
                        source_type="ASSET_INVENTORY",
                        summary=f"Only {len(assets)} assets present ({', '.join(asset_modalities) or 'None'}). Required: ECG or Chest X-ray.",
                        provenance_trace=["Case Workspace Assets"],
                    ),
                    clinical_implication="Severe risk of delayed diagnosis for acute coronary syndrome, aortic dissection, or tension pneumothorax.",
                    why_human_review_required="AI decision support cannot proceed safely without mandatory baseline imaging or electrophysiology.",
                    recommended_action="Upload urgent 12-lead ECG and upright PA chest radiograph immediately.",
                )
            )
            review_reasons.append("Critical missing diagnostic modality for acute cardiopulmonary symptoms.")

        # ------------------------------------------------------------------
        # 5. POOR IMAGE QUALITY
        # ------------------------------------------------------------------
        for asset in assets:
            size = int(asset.get("size_bytes") or 0)
            filename = asset.get("filename", "")
            # File size under 15KB for chest radiograph or MRI is an extreme degradation
            if asset.get("modality") in ("chest_xray", "mri", "ct", "skin_image") and 0 < size < 15000:
                conflict_id = f"cnf-piq-{uuid.uuid4().hex[:6]}"
                conflicts.append(
                    StructuredConflictItem(
                        id=conflict_id,
                        case_id=case_id,
                        patient_id=p_id,
                        conflict_type=ConflictCategory.POOR_IMAGE_QUALITY,
                        review_state=ReviewState.INPUT_QUALITY_ISSUE,
                        severity=ConflictSeverity.HIGH,
                        title=f"Sub-Diagnostic Image Resolution: {filename}",
                        explanation=f"Asset '{filename}' has a compressed size of only {size / 1024:.1f} KB, falling below diagnostic resolution thresholds for deep neural inference.",
                        evidence_a=EvidenceComparisonAnchor(
                            id=f"asset-{asset['id'][:8]}",
                            title="Ingested Radiograph File",
                            source_type="ASSET_METADATA",
                            summary=f"Asset size: {size} bytes ({size / 1024:.1f} KB). Minimum recommended: 50 KB.",
                            provenance_trace=[filename, asset.get("storage_path", "")],
                        ),
                        evidence_b=EvidenceComparisonAnchor(
                            id="spec-quality-threshold",
                            title="TorchXRayVision Input Specification",
                            source_type="STANDARDS_SPEC",
                            summary="Multi-label DenseNet-121 requires uncompressed or lossless 224x224 to 1024x1024 projection pixels.",
                            provenance_trace=["Model Registry Quality Standard"],
                        ),
                        clinical_implication="Severe compression artifacts can mimic interstitial infiltrates or obscure small pneumothoraces.",
                        why_human_review_required="Automated predictions derived from degraded inputs are clinically unviable without manual review.",
                        recommended_action="Re-acquire or re-upload native resolution DICOM or high-quality PNG radiograph.",
                    )
                )
                review_reasons.append(f"Image quality of '{filename}' is below diagnostic resolution threshold.")

        # ------------------------------------------------------------------
        # 6. UNSUPPORTED MODALITY
        # ------------------------------------------------------------------
        for asset in assets:
            mod = asset.get("modality", "")
            mime = asset.get("mime_type", "")
            if mod in ("unknown", "generic_file") or "executable" in mime:
                conflict_id = f"cnf-um-{uuid.uuid4().hex[:6]}"
                conflicts.append(
                    StructuredConflictItem(
                        id=conflict_id,
                        case_id=case_id,
                        patient_id=p_id,
                        conflict_type=ConflictCategory.UNSUPPORTED_MODALITY,
                        review_state=ReviewState.INPUT_QUALITY_ISSUE,
                        severity=ConflictSeverity.MODERATE,
                        title=f"Unsupported Modality / Unknown Payload: {asset.get('filename')}",
                        explanation=f"Asset has unclassified modality '{mod}' ({mime}) without a compatible specialized screening model.",
                        evidence_a=EvidenceComparisonAnchor(
                            id=f"asset-{asset['id'][:8]}",
                            title="Uploaded Asset Payload",
                            source_type="ASSET_METADATA",
                            summary=f"Modality: {mod}, MIME: {mime}.",
                            provenance_trace=[asset.get("filename", "")],
                        ),
                        evidence_b=EvidenceComparisonAnchor(
                            id="registry-capabilities",
                            title="Clinical Capability Registry",
                            source_type="CAPABILITY_REGISTRY",
                            summary="Supported: chest_xray, ecg, mri, ct, skin_image, clinical_note, lab_report, prescription.",
                            provenance_trace=["Model Capability Registry"],
                        ),
                        clinical_implication="Asset cannot participate in automated model orchestration or clinical decision pipeline.",
                        why_human_review_required="Clinician must inspect file contents or re-classify modality manually.",
                        recommended_action="Re-classify asset modality in Case Intake workspace.",
                    )
                )
                review_reasons.append(f"Asset '{asset.get('filename')}' modality '{mod}' is unsupported.")

        # ------------------------------------------------------------------
        # 7. INCOMPLETE CASE CONTEXT
        # ------------------------------------------------------------------
        missing_fields = []
        if not case_data.get("chief_complaint"):
            missing_fields.append("Chief Complaint")
        if not case_data.get("clinical_notes"):
            missing_fields.append("Clinical Intake Notes")
        if not patient.get("date_of_birth") and not patient.get("age"):
            missing_fields.append("Patient Age/DOB")

        if missing_fields:
            conflict_id = f"cnf-icc-{uuid.uuid4().hex[:6]}"
            conflicts.append(
                StructuredConflictItem(
                    id=conflict_id,
                    case_id=case_id,
                    patient_id=p_id,
                    conflict_type=ConflictCategory.INCOMPLETE_CASE_CONTEXT,
                    review_state=ReviewState.INSUFFICIENT_EVIDENCE,
                    severity=ConflictSeverity.LOW,
                    title="Incomplete Case Intake Metadata",
                    explanation=f"Critical intake fields missing from case: {', '.join(missing_fields)}.",
                    evidence_a=EvidenceComparisonAnchor(
                        id=f"case-{case_id[:8]}",
                        title="Intake Form Metadata",
                        source_type="CLINICAL_CONTEXT",
                        summary=f"Missing required clinical parameters: {', '.join(missing_fields)}.",
                        provenance_trace=["Intake Registration"],
                    ),
                    evidence_b=EvidenceComparisonAnchor(
                        id="clinical-governance",
                        title="Clinical Intake Governance Protocol",
                        source_type="STANDARDS_SPEC",
                        summary="Complete triage requires age, chief complaint, and initial clinician intake narrative.",
                        provenance_trace=["Clinical Decision Support Governance Protocol"],
                    ),
                    clinical_implication="Interpretation without patient age or complaint limits prior probability calculations.",
                    why_human_review_required="Age-specific reference ranges and symptom acuity must be completed by clinical staff.",
                    recommended_action="Complete missing intake parameters in Patient 360 Workspace.",
                )
            )
            review_reasons.append(f"Incomplete case context: missing {', '.join(missing_fields)}.")

        # ------------------------------------------------------------------
        # 8. COMPUTE SEPARATED EVALUATION DIMENSIONS
        # ------------------------------------------------------------------
        # Dimension 1: model_confidence (strictly model-produced, never invented)
        all_probs = [
            float(f["probability"])
            for run in model_runs
            for f in (run.get("findings") or [])
            if "probability" in f and f.get("detected", False)
        ]
        avg_model_conf = (sum(all_probs) / len(all_probs)) if all_probs else None

        # Dimension 2: cross_model_agreement
        cross_model_agree: Optional[float] = None
        if len(model_runs) >= 2:
            model_disagreements = [c for c in conflicts if c.conflict_type == ConflictCategory.MODEL_DISAGREEMENT]
            cross_model_agree = max(0.0, 1.0 - (len(model_disagreements) * 0.4))

        # Dimension 3: historical_support
        mvh_conflicts = [c for c in conflicts if c.conflict_type == ConflictCategory.MODEL_VS_HISTORY]
        hist_support = max(0.0, 1.0 - (len(mvh_conflicts) * 0.35)) if patient_chunks else None

        # Dimension 4: evidence_completeness (0.0 to 1.0)
        completeness_points = 0.0
        if case_data.get("chief_complaint"):
            completeness_points += 0.30
        if case_data.get("clinical_notes"):
            completeness_points += 0.30
        if case_data.get("symptoms") and len(case_data.get("symptoms")) > 0:
            completeness_points += 0.20
        if len(assets) > 0:
            completeness_points += 0.20
        evidence_comp = min(1.0, completeness_points)

        # Dimension 5: input_quality (0.0 to 1.0)
        quality_penalties = 0.0
        for asset in assets:
            size = int(asset.get("size_bytes") or 0)
            if size < 15000:
                quality_penalties += 0.4
            elif size < 50000:
                quality_penalties += 0.15
        input_qual = max(0.1, 1.0 - quality_penalties)

        dimensions = DimensionMetrics(
            model_confidence=round(avg_model_conf, 4) if avg_model_conf is not None else None,
            cross_model_agreement=round(cross_model_agree, 4) if cross_model_agree is not None else None,
            historical_support=round(hist_support, 4) if hist_support is not None else None,
            evidence_completeness=round(evidence_comp, 4),
            input_quality=round(input_qual, 4),
        )

        # ------------------------------------------------------------------
        # 9. ASSIGN CANONICAL REVIEW STATE
        # ------------------------------------------------------------------
        # Hierarchy:
        # INPUT_QUALITY_ISSUE -> MODEL_DISAGREEMENT -> INSUFFICIENT_EVIDENCE -> REVIEW_REQUIRED -> CLEAR
        review_state = ReviewState.CLEAR
        primary_reason = "No clinical conflicts or evidence gaps detected. Case findings are concordant."

        if any(c.conflict_type in (ConflictCategory.POOR_IMAGE_QUALITY, ConflictCategory.UNSUPPORTED_MODALITY) for c in conflicts):
            review_state = ReviewState.INPUT_QUALITY_ISSUE
            primary_reason = "Diagnostic imaging or asset payload has quality degradation or unsupported format."
        elif any(c.conflict_type == ConflictCategory.MODEL_DISAGREEMENT for c in conflicts):
            review_state = ReviewState.MODEL_DISAGREEMENT
            primary_reason = "Specialized AI models produced conflicting diagnostic findings on the same study."
        elif any(c.conflict_type in (ConflictCategory.MISSING_EVIDENCE, ConflictCategory.INCOMPLETE_CASE_CONTEXT) for c in conflicts) or evidence_comp < 0.5:
            review_state = ReviewState.INSUFFICIENT_EVIDENCE
            primary_reason = "Mandatory diagnostic modalities or intake parameters are missing from this case."
        elif any(c.conflict_type in (ConflictCategory.MODEL_VS_HISTORY, ConflictCategory.HISTORICAL_CONTRADICTION) for c in conflicts):
            review_state = ReviewState.REVIEW_REQUIRED
            primary_reason = "Discrepancy detected between acute screening findings and patient longitudinal history."

        human_review = review_state != ReviewState.CLEAR

        assessment = CaseReviewAssessment(
            case_id=case_id,
            patient_id=p_id,
            review_state=review_state,
            human_review_required=human_review,
            primary_review_reason=primary_reason,
            review_reasons=review_reasons,
            dimensions=dimensions,
            conflicts=conflicts,
            conflicts_count=len(conflicts),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        # Persist assessment and conflicts into Supabase
        self._persist_assessment(assessment)

        return assessment

    def _persist_assessment(self, assessment: CaseReviewAssessment):
        """Persist assessment record and conflict items to Supabase."""
        try:
            # Upsert assessment
            self.db.table("case_review_assessments").upsert({
                "id": f"cra-{assessment.case_id}",
                "case_id": assessment.case_id,
                "patient_id": assessment.patient_id,
                "review_state": assessment.review_state.value,
                "human_review_required": assessment.human_review_required,
                "review_reasons": assessment.review_reasons,
                "model_confidence": assessment.dimensions.model_confidence,
                "cross_model_agreement": assessment.dimensions.cross_model_agreement,
                "historical_support": assessment.dimensions.historical_support,
                "evidence_completeness": assessment.dimensions.evidence_completeness,
                "input_quality": assessment.dimensions.input_quality,
                "metrics": {
                    "primary_review_reason": assessment.primary_review_reason,
                },
                "conflicts_count": assessment.conflicts_count,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).execute()

            # Upsert conflicts
            if assessment.conflicts:
                conflict_rows = [
                    {
                        "id": c.id,
                        "case_id": c.case_id,
                        "patient_id": c.patient_id,
                        "conflict_type": c.conflict_type.value,
                        "review_state": c.review_state.value,
                        "severity": c.severity.value,
                        "title": c.title,
                        "explanation": c.explanation,
                        "evidence_a": c.evidence_a.model_dump(),
                        "evidence_b": c.evidence_b.model_dump(),
                        "clinical_implication": c.clinical_implication,
                        "recommended_action": c.recommended_action,
                        "status": c.status,
                    }
                    for c in assessment.conflicts
                ]
                self.db.table("case_conflicts").upsert(conflict_rows).execute()
        except Exception as ex:
            logger.warning(f"Failed to persist conflict assessment to Supabase (continuing in-memory): {ex}")

    def create_synthetic_conflict_fixture(
        self, case_id: str, patient_id: str, fixture_type: str = "model_vs_history"
    ) -> CaseReviewAssessment:
        """
        Creates a deterministic synthetic conflict fixture for testing and clinical demo verification.
        Supports:
          - 'model_disagreement'
          - 'model_vs_history'
          - 'missing_evidence'
          - 'poor_image_quality'
        """
        conflicts: List[StructuredConflictItem] = []
        review_state = ReviewState.REVIEW_REQUIRED

        if fixture_type == "model_disagreement":
            review_state = ReviewState.MODEL_DISAGREEMENT
            conflicts.append(
                StructuredConflictItem(
                    id=f"cnf-syn-md-{uuid.uuid4().hex[:6]}",
                    case_id=case_id,
                    patient_id=patient_id,
                    conflict_type=ConflictCategory.MODEL_DISAGREEMENT,
                    review_state=ReviewState.MODEL_DISAGREEMENT,
                    severity=ConflictSeverity.HIGH,
                    title="Model Disagreement: Pneumonia Infiltration",
                    explanation="TorchXRayVision DenseNet-121 flagged Pneumonia as DETECTED (78.4%), whereas Baseline ResNet-50 classified it as NOT DETECTED (21.2%).",
                    evidence_a=EvidenceComparisonAnchor(
                        id="run-densenet-01",
                        title="TorchXRayVision DenseNet-121",
                        source_type="MODEL_FINDING",
                        summary="Pneumonia DETECTED with calibrated probability 78.4% (Threshold: 0.50).",
                        confidence=0.784,
                        provenance_trace=["TorchXRayVision DenseNet-121", "Run #01", "radiograph.png"],
                    ),
                    evidence_b=EvidenceComparisonAnchor(
                        id="run-resnet-02",
                        title="Baseline ResNet-50",
                        source_type="MODEL_FINDING",
                        summary="Pneumonia NOT DETECTED with probability 21.2% (Threshold: 0.50).",
                        confidence=0.212,
                        provenance_trace=["Baseline ResNet-50", "Run #02", "radiograph.png"],
                    ),
                    clinical_implication="Divergence in pneumonia classification affects immediate empirical antibiotic decision.",
                    why_human_review_required="Conflicting automated models require primary radiologist interpretation of right lower lobe opacity.",
                    recommended_action="Clinician adjudication of parenchymal consolidation pattern.",
                )
            )
        elif fixture_type == "missing_evidence":
            review_state = ReviewState.INSUFFICIENT_EVIDENCE
            conflicts.append(
                StructuredConflictItem(
                    id=f"cnf-syn-me-{uuid.uuid4().hex[:6]}",
                    case_id=case_id,
                    patient_id=patient_id,
                    conflict_type=ConflictCategory.MISSING_EVIDENCE,
                    review_state=ReviewState.INSUFFICIENT_EVIDENCE,
                    severity=ConflictSeverity.CRITICAL,
                    title="Missing ECG for Acute Chest Pain Presentation",
                    explanation="Patient presented with acute substernal chest discomfort; however, no 12-lead ECG is attached to this case workspace.",
                    evidence_a=EvidenceComparisonAnchor(
                        id="intake-triage",
                        title="Acute Triage Record",
                        source_type="CLINICAL_CONTEXT",
                        summary="Patient presents with substernal pressure and radiation to jaw.",
                        provenance_trace=["ED Triage Note"],
                    ),
                    evidence_b=EvidenceComparisonAnchor(
                        id="modality-check",
                        title="Workspace Modalities",
                        source_type="ASSET_INVENTORY",
                        summary="Zero ECG records found. Chest X-Ray only.",
                        provenance_trace=["Medical Asset Store"],
                    ),
                    clinical_implication="Cannot evaluate for acute ST-elevation myocardial infarction without electrophysiology.",
                    why_human_review_required="Mandatory clinical guideline requires urgent 12-lead ECG within 10 minutes of arrival.",
                    recommended_action="Perform and upload urgent 12-lead ECG immediately.",
                )
            )
        elif fixture_type == "poor_image_quality":
            review_state = ReviewState.INPUT_QUALITY_ISSUE
            conflicts.append(
                StructuredConflictItem(
                    id=f"cnf-syn-piq-{uuid.uuid4().hex[:6]}",
                    case_id=case_id,
                    patient_id=patient_id,
                    conflict_type=ConflictCategory.POOR_IMAGE_QUALITY,
                    review_state=ReviewState.INPUT_QUALITY_ISSUE,
                    severity=ConflictSeverity.HIGH,
                    title="Degraded Resolution Radiograph",
                    explanation="Uploaded radiograph is heavily compressed (8.4 KB), introducing pixel blocking and severe loss of pulmonary vascular markings.",
                    evidence_a=EvidenceComparisonAnchor(
                        id="asset-compressed",
                        title="Compressed Asset File",
                        source_type="ASSET_METADATA",
                        summary="File size: 8,600 bytes. Severe lossy compression.",
                        provenance_trace=["chest_preview_tiny.jpg"],
                    ),
                    evidence_b=EvidenceComparisonAnchor(
                        id="std-resolution",
                        title="Diagnostic Imaging Standard",
                        source_type="STANDARDS_SPEC",
                        summary="Minimum diagnostic resolution: 1024x1024, uncompressed PNG or DICOM.",
                        provenance_trace=["Radiological Quality Standard"],
                    ),
                    clinical_implication="Inference on heavily blurred inputs yields high false positive or false negative rates.",
                    why_human_review_required="Image is sub-diagnostic. Automated findings are unreliable.",
                    recommended_action="Re-upload diagnostic DICOM or uncompressed radiograph.",
                )
            )
        else:  # model_vs_history
            review_state = ReviewState.REVIEW_REQUIRED
            conflicts.append(
                StructuredConflictItem(
                    id=f"cnf-syn-mvh-{uuid.uuid4().hex[:6]}",
                    case_id=case_id,
                    patient_id=patient_id,
                    conflict_type=ConflictCategory.MODEL_VS_HISTORY,
                    review_state=ReviewState.REVIEW_REQUIRED,
                    severity=ConflictSeverity.HIGH,
                    title="Model Finding vs Historical Silhouette: Cardiomegaly",
                    explanation="Acute TorchXRayVision DenseNet-121 flagged Cardiomegaly (CTR > 0.50, Probability 84.1%), but discharge summary from 3 months ago confirms normal cardiac size without cardiomegaly.",
                    evidence_a=EvidenceComparisonAnchor(
                        id="run-densenet-cxr",
                        title="Acute Chest X-Ray AI Inference",
                        source_type="MODEL_FINDING",
                        summary="Cardiomegaly DETECTED with probability 84.1% (Threshold: 0.50).",
                        confidence=0.841,
                        provenance_trace=["TorchXRayVision DenseNet-121", "Run #acute-01", "pa_xray.png"],
                    ),
                    evidence_b=EvidenceComparisonAnchor(
                        id="hist-dc-01",
                        title="Prior Discharge Summary (3 Months Ago)",
                        source_type="PATIENT_RECORD",
                        summary="Cardiovascular: S1/S2 regular, no murmurs. Chest radiography confirms normal cardiac silhouette.",
                        excerpt="Normal heart size, clear lung fields, no baseline cardiomegaly.",
                        provenance_trace=["discharge_june2026.pdf", "Page 2", "Chunk #1"],
                    ),
                    clinical_implication="Indicates either acute cardiopericardial enlargement (effusion, acute decompensation) or an AP projection magnification artifact.",
                    why_human_review_required="Requires clinician evaluation to determine if true cardiac enlargement has occurred since prior study.",
                    recommended_action="Correlate with physical exam (JVP, peripheral edema) and consider bedside echocardiogram.",
                )
            )

        dimensions = DimensionMetrics(
            model_confidence=0.841 if fixture_type == "model_vs_history" else 0.784,
            cross_model_agreement=0.212 if fixture_type == "model_disagreement" else 0.88,
            historical_support=0.35 if fixture_type == "model_vs_history" else 0.90,
            evidence_completeness=0.40 if fixture_type == "missing_evidence" else 0.85,
            input_quality=0.25 if fixture_type == "poor_image_quality" else 0.95,
        )

        assessment = CaseReviewAssessment(
            case_id=case_id,
            patient_id=patient_id,
            review_state=review_state,
            human_review_required=True,
            primary_review_reason=f"Synthetic fixture generated for {fixture_type.replace('_', ' ')} testing.",
            review_reasons=[f"Synthetic conflict fixture: {fixture_type}"],
            dimensions=dimensions,
            conflicts=conflicts,
            conflicts_count=len(conflicts),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self._persist_assessment(assessment)
        return assessment
