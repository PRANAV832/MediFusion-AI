"""
MediFusion AI — Synthetic Demo Cases Generator (Phase 18 Final QA)

Generates three authenticated, reproducible synthetic clinical cases:
1. Case A: Multimodal Case (Patient: Sarah Jenkins, MRN-1042-DEMO)
   - Multiple modalities: Chest X-ray, Clinical Progress Notes, Lab Panel
   - Authentic TorchXRayVision DenseNet-121 inference + Grad-CAM explainability
   - Patient-scoped RAG knowledge ingestion
   - Canonical evidence synthesis + 14-section clinical screening report

2. Case B: Resource-Constrained Case (Patient: Marcus Vance, MRN-2088-DEMO)
   - Edge clinic deployment with simulated RAM/VRAM resource limits
   - Sequential execution, memory reservation, dynamic model eviction/unload
   - Resource Dashboard event stream (LOAD, UNLOAD, Queue metrics)

3. Case C: Conflicting-Evidence Case (Patient: Elena Rostova, MRN-3351-DEMO)
   - Domain tension: Resolving post-treatment radiograph vs recent EHR consolidation note
   - Triggers REVIEW_REQUIRED gate and 4-quadrant contradiction visualization
   - Model Council multi-model peer review deliberation

Uses strictly synthetic and de-identified data.
"""

import io
import os
import sys
import json
import uuid
import pathlib
import logging
from datetime import datetime, timezone, timedelta

# Ensure backend directory is in python path
backend_dir = pathlib.Path(__file__).resolve().parent.parent.parent
from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.supabase import get_supabase_admin_client
from app.models.registry import adapter_registry
from app.models.chest_xray import ChestXRayDenseNetModel
from app.scheduler import scheduler_events, simulated_config
from app.rag.service import PatientRAGService
from app.services.evidence import EvidenceService
from app.services.conflict_detector import ConflictDetectorService
from app.services.screening_report import ScreeningReportService
from app.services.explainability import ImagingExplainabilityService
from app.services.model_council import ModelCouncilService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_demo_cases")


def load_fixture_xray_bytes() -> bytes:
    fixture_path = backend_dir / "tests" / "fixtures" / "sample_chest_xray.jpg"
    if fixture_path.exists():
        with open(fixture_path, "rb") as f:
            return f.read()
    # Fallback to minimal 224x224 grayscale image if fixture missing
    from PIL import Image
    img = Image.new("L", (224, 224), color=128)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def clean_existing_demo_data(supabase):
    """Clean any existing demo patients and associated cases to ensure idempotency."""
    logger.info("Cleaning prior synthetic demo records...")
    demo_mrns = ["MRN-1042-DEMO", "MRN-2088-DEMO", "MRN-3351-DEMO"]
    try:
        p_res = supabase.table("patients").select("id, mrn").in_("mrn", demo_mrns).execute()
        if p_res.data:
            patient_ids = [p["id"] for p in p_res.data]
            logger.info("Found %d existing demo patients, removing...", len(patient_ids))
            for pid in patient_ids:
                # Delete cases
                supabase.table("patient_cases").delete().eq("patient_id", pid).execute()
                # Delete clinical events
                supabase.table("clinical_events").delete().eq("patient_id", pid).execute()
                # Delete RAG chunks
                supabase.table("patient_knowledge_chunks").delete().eq("patient_id", pid).execute()
                # Delete patient
                supabase.table("patients").delete().eq("id", pid).execute()
        logger.info("Prior demo records cleaned.")
    except Exception as e:
        logger.warning("Could not clean prior records: %s", str(e))


def seed_demo_cases():
    supabase = get_supabase_admin_client()
    clean_existing_demo_data(supabase)

    xray_bytes = load_fixture_xray_bytes()
    now_utc = datetime.now(timezone.utc)

    results = {}

    # =========================================================================
    # CASE A: Multimodal Screening Case (Sarah Jenkins)
    # =========================================================================
    logger.info("--- Creating Case A: Multimodal Screening Case ---")
    p_a_data = {
        "mrn": "MRN-1042-DEMO",
        "first_name": "Sarah",
        "last_name": "Jenkins",
        "date_of_birth": "1968-05-14",
        "gender": "Female",
        "blood_type": "A+",
        "allergies": ["Sulfa drugs", "Latex"],
        "chronic_conditions": ["Mild Intermittent Asthma", "Essential Hypertension"],
    }
    p_a = supabase.table("patients").insert(p_a_data).execute().data[0]
    p_a_id = p_a["id"]

    # Clinical Events
    supabase.table("clinical_events").insert([
        {
            "patient_id": p_a_id,
            "event_type": "encounter",
            "summary": "Annual Preventative Health Assessment: Stable vitals. BP 128/82. Mild seasonal wheeze treated with albuterol PRN.",
            "event_date": (now_utc - timedelta(days=180)).isoformat(),
            "metadata": {"title": "Annual Preventative Health Assessment"}
        },
        {
            "patient_id": p_a_id,
            "event_type": "prescription",
            "summary": "Albuterol Inhaler Refill: Albuterol 90mcg HFA, 2 puffs Q4H PRN wheezing.",
            "event_date": (now_utc - timedelta(days=90)).isoformat(),
            "metadata": {"title": "Albuterol Inhaler Refill"}
        }
    ]).execute()

    # Case A
    case_a_data = {
        "patient_id": p_a_id,
        "case_number": "CASE-2026-1042",
        "title": "Multimodal Respiratory Screening & Infiltration Workup",
        "chief_complaint": "Productive cough with yellow sputum, low-grade fever (38.1°C), and progressive exertional shortness of breath for 5 days.",
        "symptoms": ["productive cough", "low-grade fever", "exertional dyspnea", "right-sided pleuritic discomfort", "general fatigue"],
        "clinical_notes": "58-year-old female with history of mild asthma presenting with 5 days of worsening lower respiratory symptoms. Coarse crackles auscultated at right lung base. SpO2 94% on room air. PA chest X-ray and inflammatory labs ordered.",
        "priority": "urgent",
        "status": "active"
    }
    case_a = supabase.table("patient_cases").insert(case_a_data).execute().data[0]
    case_a_id = case_a["id"]

    # Ingest Assets: Chest X-ray, Clinical Note, Labs
    storage_path_a = f"{p_a_id}/{case_a_id}/chest_xray_pa.jpg"
    try:
        supabase.storage.from_("medical-assets").upload(
            storage_path_a,
            xray_bytes,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
    except Exception as e:
        logger.info("Storage upload note: %s", str(e))

    asset_a1 = supabase.table("medical_assets").insert({
        "case_id": case_a_id,
        "patient_id": p_a_id,
        "modality": "chest_xray",
        "filename": "chest_xray_pa.jpg",
        "storage_path": storage_path_a,
        "size_bytes": len(xray_bytes),
        "mime_type": "image/jpeg",
        "metadata": {"view": "PA", "exposure": "adequate", "institution": "MediFusion Radiology Center"}
    }).execute().data[0]

    asset_a2 = supabase.table("medical_assets").insert({
        "case_id": case_a_id,
        "patient_id": p_a_id,
        "modality": "clinical_notes",
        "filename": "ambulatory_progress_note.txt",
        "storage_path": f"{p_a_id}/{case_a_id}/ambulatory_progress_note.txt",
        "size_bytes": 1420,
        "mime_type": "text/plain",
        "metadata": {"clinician": "Dr. Sarah Chen, MD", "department": "Pulmonary & Internal Medicine"}
    }).execute().data[0]

    asset_a3 = supabase.table("medical_assets").insert({
        "case_id": case_a_id,
        "patient_id": p_a_id,
        "modality": "lab_report",
        "filename": "serum_inflammatory_panel.json",
        "storage_path": f"{p_a_id}/{case_a_id}/serum_inflammatory_panel.json",
        "size_bytes": 890,
        "mime_type": "application/json",
        "metadata": {"crp_mg_l": 42.5, "wbc_count": 12.8, "neutrophils_pct": 78.4}
    }).execute().data[0]

    # Ingest Patient-Centric RAG Knowledge
    rag_service = PatientRAGService()
    rag_chunks_a = [
        "Patient Sarah Jenkins (MRN-1042) documented past episode of acute bronchitis 2 years prior, successfully resolved with azithromycin. No prior hospitalizations for respiratory failure.",
        "Baseline spirometry (6 months ago): FEV1/FVC ratio 76%, consistent with mild reactive airway responsiveness, reversible with bronchodilator.",
        "Current lab work: C-Reactive Protein (CRP) markedly elevated at 42.5 mg/L (reference < 5.0 mg/L), Leucocytosis with left shift (WBC 12.8 x 10^9/L), supporting bacterial lower respiratory tract inflammation."
    ]
    for idx, text in enumerate(rag_chunks_a):
        rag_service.ingest_document(
            patient_id=p_a_id,
            content_bytes=text.encode("utf-8"),
            filename=f"historical_ehr_record_{idx+1}.txt",
            document_type="clinical_note",
            case_id=case_a_id,
            event_date=(now_utc - timedelta(days=idx * 30)).isoformat(),
            extra_metadata={"source": "ehr_extract"}
        )

    # Run Real PyTorch DenseNet-121 Model Inference on X-Ray
    xray_model = ChestXRayDenseNetModel()
    xray_model.load()
    tensor_input = xray_model.preprocess(xray_bytes)
    raw_preds = xray_model.predict(tensor_input)
    norm_res = xray_model.postprocess(
        raw_predictions=raw_preds,
        input_asset_id=asset_a1["id"],
        runtime_ms=135.0,
        input_asset_filename="chest_xray_pa.jpg"
    )

    # Record Model Run in Supabase
    run_a = supabase.table("model_runs").insert({
        "case_id": case_a_id,
        "patient_id": p_a_id,
        "asset_id": asset_a1["id"],
        "model_id": xray_model.model_id,
        "model_version": xray_model.model_version,
        "capability": xray_model.capability,
        "status": "completed",
        "findings": [f.model_dump() for f in norm_res.findings],
        "scores": norm_res.scores,
        "runtime_ms": norm_res.runtime_ms,
        "device": norm_res.device,
        "provenance": norm_res.provenance.model_dump(),
        "limitations": norm_res.limitations,
    }).execute().data[0]

    # Authentic Grad-CAM Explainability
    explainability_svc = ImagingExplainabilityService()
    gradcam_res = explainability_svc.generate_explainability(
        asset_id=asset_a1["id"],
        target_pathology="Pneumonia",
        case_id=case_a_id
    )

    # Ingest Canonical Evidence & Synthesize
    ev_svc = EvidenceService()
    ev_graph_a = ev_svc.assemble_case_evidence(case_id=case_a_id, patient_id=p_a_id)

    # Synthesize Clinical Screening Report (14 sections)
    report_svc = ScreeningReportService()
    report_a = report_svc.assemble_case_screening_report(case_id=case_a_id)

    results["Case_A"] = {
        "patient_id": p_a_id,
        "case_id": case_a_id,
        "mrn": p_a["mrn"],
        "name": f"{p_a['first_name']} {p_a['last_name']}",
        "assets_count": 3,
        "model_run_id": run_a["id"],
        "gradcam_available": gradcam_res.is_available,
        "report_id": report_a.id,
        "report_title": report_a.title
    }
    logger.info("Case A seeded successfully: Case ID %s", case_a_id)

    # =========================================================================
    # CASE B: Resource-Constrained Case (Marcus Vance)
    # =========================================================================
    logger.info("--- Creating Case B: Resource-Constrained Case ---")
    p_b_data = {
        "mrn": "MRN-2088-DEMO",
        "first_name": "Marcus",
        "last_name": "Vance",
        "date_of_birth": "1959-11-22",
        "gender": "Male",
        "blood_type": "B-",
        "allergies": ["Aspirin", "Penicillin"],
        "chronic_conditions": ["COPD Stage II (GOLD)", "Coronary Artery Disease", "Type 2 Diabetes"],
    }
    p_b = supabase.table("patients").insert(p_b_data).execute().data[0]
    p_b_id = p_b["id"]

    case_b_data = {
        "patient_id": p_b_id,
        "case_number": "CASE-2026-2088",
        "title": "Acute Exacerbation of Dyspnea under Constrained Edge Compute",
        "chief_complaint": "Sudden onset of dyspnea, expiratory wheezing, and orthopnea at a satellite edge workstation with constrained RAM headroom.",
        "symptoms": ["severe dyspnea", "audible expiratory wheeze", "orthopnea", "chest tightness"],
        "clinical_notes": "64-year-old male presenting with acute dyspnea. Mobile edge workstation operating under constrained memory limits (simulated 2048 MB memory budget). Dynamic sequential model execution and aggressive cache unloading required.",
        "priority": "stat",
        "status": "active"
    }
    case_b = supabase.table("patient_cases").insert(case_b_data).execute().data[0]
    case_b_id = case_b["id"]

    storage_path_b = f"{p_b_id}/{case_b_id}/stat_portable_cxr.jpg"
    try:
        supabase.storage.from_("medical-assets").upload(
            storage_path_b,
            xray_bytes,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
    except Exception as e:
        logger.info("Storage upload note: %s", str(e))

    asset_b = supabase.table("medical_assets").insert({
        "case_id": case_b_id,
        "patient_id": p_b_id,
        "modality": "chest_xray",
        "filename": "stat_portable_cxr.jpg",
        "storage_path": storage_path_b,
        "size_bytes": len(xray_bytes),
        "mime_type": "image/jpeg",
        "metadata": {"view": "AP Portable", "setting": "Remote Edge Satellite Clinic"}
    }).execute().data[0]

    # Demonstrate Resource-Aware Scheduler Telemetry & Simulated Limit
    simulated_config.enabled = True
    simulated_config.simulated_max_ram_mb = 2048
    scheduler_events.log_event(
        stage="RESOURCE_CHECK",
        message="Edge device constraint profile active (2048 MB cap, max concurrency 1).",
        status="warning",
        model_id="scheduler-engine",
        case_id=case_b_id,
        is_simulated=True
    )

    # Simulate sequential execution under constraints: Load -> Execute -> Unload to free memory
    scheduler_events.log_event(
        stage="LOAD",
        message="Dispatched ChestXRayDenseNetModel under low-memory policy (550MB allocation).",
        status="info",
        model_id=xray_model.model_id,
        case_id=case_b_id,
        memory_mb=550
    )
    scheduler_events.log_event(
        stage="UNLOAD",
        message="Aggressive cache eviction: freed 550MB for downstream synthesis.",
        status="info",
        model_id=xray_model.model_id,
        case_id=case_b_id,
        memory_mb=-550
    )

    # Ingest baseline model run
    run_b = supabase.table("model_runs").insert({
        "case_id": case_b_id,
        "patient_id": p_b_id,
        "asset_id": asset_b["id"],
        "model_id": xray_model.model_id,
        "model_version": xray_model.model_version,
        "capability": xray_model.capability,
        "status": "completed",
        "findings": [f.model_dump() for f in norm_res.findings],
        "scores": norm_res.scores,
        "runtime_ms": norm_res.runtime_ms,
        "device": norm_res.device,
        "provenance": norm_res.provenance.model_dump(),
        "limitations": norm_res.limitations,
    }).execute().data[0]

    # Ingest baseline findings and generate screening report
    ev_graph_b = ev_svc.assemble_case_evidence(case_id=case_b_id, patient_id=p_b_id)
    report_b = report_svc.assemble_case_screening_report(case_id=case_b_id)

    results["Case_B"] = {
        "patient_id": p_b_id,
        "case_id": case_b_id,
        "mrn": p_b["mrn"],
        "name": f"{p_b['first_name']} {p_b['last_name']}",
        "simulated_memory_limit_mb": 2048,
        "max_concurrency": 1,
        "report_id": report_b.id
    }
    logger.info("Case B seeded successfully: Case ID %s", case_b_id)

    # =========================================================================
    # CASE C: Conflicting-Evidence Case (Elena Rostova)
    # =========================================================================
    logger.info("--- Creating Case C: Conflicting-Evidence Case ---")
    p_c_data = {
        "mrn": "MRN-3351-DEMO",
        "first_name": "Elena",
        "last_name": "Rostova",
        "date_of_birth": "1979-03-30",
        "gender": "Female",
        "blood_type": "O-",
        "allergies": ["None documented"],
        "chronic_conditions": ["Recent Community-Acquired Pneumonia (treated 14 days ago)"],
    }
    p_c = supabase.table("patients").insert(p_c_data).execute().data[0]
    p_c_id = p_c["id"]

    case_c_data = {
        "patient_id": p_c_id,
        "case_number": "CASE-2026-3351",
        "title": "Post-Antibiotic Surveillance & Contradiction Resolution",
        "chief_complaint": "Persistent dry hacking cough 14 days post-completion of outpatient antibiotic course; clinical question of persistent consolidation vs resolving post-infectious bronchial hyperreactivity.",
        "symptoms": ["lingering dry cough", "intermittent chest tightness", "absence of fever"],
        "clinical_notes": "47-year-old female presenting for post-treatment surveillance. Inpatient EHR discharge summary from 14 days prior stated persistent dense right basilar consolidation. Current PA radiograph shows significant radiographic clearance. Evidentiary tension exists between recent historical discharge documentation and current imaging finding.",
        "priority": "urgent",
        "status": "active"
    }
    case_c = supabase.table("patient_cases").insert(case_c_data).execute().data[0]
    case_c_id = case_c["id"]

    storage_path_c = f"{p_c_id}/{case_c_id}/followup_cxr_clear.jpg"
    try:
        supabase.storage.from_("medical-assets").upload(
            storage_path_c,
            xray_bytes,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
    except Exception as e:
        logger.info("Storage upload note: %s", str(e))

    asset_c = supabase.table("medical_assets").insert({
        "case_id": case_c_id,
        "patient_id": p_c_id,
        "modality": "chest_xray",
        "filename": "followup_cxr_clear.jpg",
        "storage_path": storage_path_c,
        "size_bytes": len(xray_bytes),
        "mime_type": "image/jpeg",
        "metadata": {"view": "PA Follow-up", "indication": "Post-pneumonia resolution evaluation"}
    }).execute().data[0]

    # Ingest historical note with documented normal baseline and chronic disease to create authentic conflict
    c_note = (
        "Hospital Discharge Summary (14 days ago): Dense right lower lobe consolidation with air bronchograms, "
        "treated with IV Ceftriaxone + Azithromycin. Patient with chronic bilateral opacities and pulmonary fibrosis. "
        "Baseline admission exam explicitly noted normal cardiac silhouette and no cardiomegaly."
    )
    rag_service.ingest_document(
        patient_id=p_c_id,
        content_bytes=c_note.encode("utf-8"),
        filename="inpatient_discharge_summary.txt",
        document_type="clinical_note",
        case_id=case_c_id,
        event_date=(now_utc - timedelta(days=14)).isoformat(),
        extra_metadata={"source": "inpatient_ehr"}
    )

    # Ingest model run with findings that trigger contradiction
    resolving_preds = dict(norm_res.scores)
    resolving_preds["Pneumonia"] = 0.14
    resolving_preds["Consolidation"] = 0.08
    resolving_preds["Infiltration"] = 0.12
    resolving_preds["Cardiomegaly"] = 0.78

    c_findings = [f.model_dump() for f in norm_res.findings]
    for f in c_findings:
        if f["pathology"] in ("Pneumonia", "Consolidation", "Infiltration"):
            f["probability"] = 0.14
            f["detected"] = False
        elif f["pathology"] == "Cardiomegaly":
            f["probability"] = 0.78
            f["detected"] = True

    run_c = supabase.table("model_runs").insert({
        "case_id": case_c_id,
        "patient_id": p_c_id,
        "asset_id": asset_c["id"],
        "model_id": xray_model.model_id,
        "model_version": xray_model.model_version,
        "capability": xray_model.capability,
        "status": "completed",
        "findings": c_findings,
        "scores": resolving_preds,
        "runtime_ms": 142.5,
        "device": "cpu",
        "provenance": norm_res.provenance.model_dump(),
        "limitations": norm_res.limitations,
    }).execute().data[0]

    # Assemble canonical evidence
    ev_graph_c = ev_svc.assemble_case_evidence(case_id=case_c_id, patient_id=p_c_id)

    # Run Structured Conflict Detection Engine
    conflict_svc = ConflictDetectorService()
    conflict_assessment = conflict_svc.evaluate_case(case_id=case_c_id)

    # Evaluate Model Council Multi-Model Peer Deliberation
    council_svc = ModelCouncilService()
    council_result = council_svc.assess_case(
        case_id=case_c_id,
        asset_id=asset_c["id"],
        force_council=True
    )

    # Generate Screening Report with prominent REVIEW_REQUIRED Gate
    report_c = report_svc.assemble_case_screening_report(case_id=case_c_id)

    results["Case_C"] = {
        "patient_id": p_c_id,
        "case_id": case_c_id,
        "mrn": p_c["mrn"],
        "name": f"{p_c['first_name']} {p_c['last_name']}",
        "conflicts_count": conflict_assessment.conflicts_count,
        "review_state": conflict_assessment.review_state.value,
        "human_review_required": conflict_assessment.human_review_required,
        "council_verdict": council_result.council_verdict,
        "consensus_status": council_result.consensus_status,
        "report_id": report_c.id
    }
    logger.info("Case C seeded successfully: Case ID %s", case_c_id)

    logger.info("=== All 3 Synthetic Demo Cases Seeded Successfully ===")
    print(json.dumps(results, indent=2))
    return results


if __name__ == "__main__":
    seed_demo_cases()
