"""Core Intelligent Model Orchestrator engine for MediFusion AI.

Implements the deterministic, auditable 9-step model selection and DAG construction algorithm:
1. Inspect case modalities
2. Resolve required capabilities
3. Query Model Registry & Capability Registry
4. Remove unavailable models (NOT_CONFIGURED / UNAVAILABLE)
5. Remove incompatible models
6. Check resources (RAM / VRAM / Compute headroom)
7. Select models with deterministic symptom context scoring
8. Build execution order & Directed Acyclic Graph (DAG)
9. Persist execution plan
"""

import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from app.models.registry import adapter_registry
from app.orchestration.resource_state import inspect_resource_state, check_resource_fit
from app.orchestration.dag import ExecutionDAG, DAGNode
from app.core.supabase import get_supabase_admin_client


class ModelOrchestrator:
    """Intelligent Model Orchestrator engine executing deterministic capability selection."""

    # Modality mappings to candidate capabilities
    MODALITY_CAPABILITY_MAP: Dict[str, List[str]] = {
        "chest_xray": ["pneumonia_screening", "lung_opacity_abnormality_screening"],
        "mri": ["brain_tumor_screening", "brain_stroke_abnormality_screening"],
        "ct": ["brain_stroke_abnormality_screening"],
        "ecg": ["arrhythmia_cardiac_abnormality_screening"],
        "skin_image": ["skin_lesion_screening"],
    }

    # Document modalities that route to Document Processing & Patient RAG
    DOCUMENT_MODALITIES = {"clinical_note", "lab_report", "prescription", "document", "pdf"}

    # Symptom keyword heuristics for deterministic priority boosting
    SYMPTOM_KEYWORDS: Dict[str, List[str]] = {
        "pneumonia_screening": ["fever", "cough", "phlegm", "sputum", "crackles", "dyspnea", "chills", "respiratory", "infiltrate"],
        "lung_opacity_abnormality_screening": ["shortness of breath", "pleural", "effusion", "consolidation", "atelectasis", "hypoxia", "wheezing"],
        "brain_tumor_screening": ["headache", "seizure", "vision loss", "papilledema", "neurological", "mass", "glioma", "cranial"],
        "brain_stroke_abnormality_screening": ["stroke", "hemiparesis", "aphasia", "facial droop", "slurred speech", "ischemia", "infarct", "weakness"],
        "arrhythmia_cardiac_abnormality_screening": ["palpitations", "syncope", "chest pain", "arrhythmia", "bradycardia", "tachycardia", "flutter", "irregular pulse"],
        "skin_lesion_screening": ["mole", "melanoma", "rash", "pigmented", "asymmetry", "border", "dermatitis", "erythema", "lesion"],
    }

    def plan_case_execution(
        self,
        case_id: str,
        patient_id: str,
        case_metadata: Dict[str, Any],
        assets: List[Dict[str, Any]],
        symptoms_context: Optional[str] = None,
        created_by: Optional[str] = None,
        force_replan: bool = False,
    ) -> Dict[str, Any]:
        """Execute the deterministic 9-step orchestration algorithm and persist plan."""
        # Check if an existing planned orchestration plan exists for this case unless forced
        admin_client = get_supabase_admin_client()
        if not force_replan:
            try:
                res = (
                    admin_client.table("orchestration_plans")
                    .select("*")
                    .eq("case_id", case_id)
                    .eq("status", "planned")
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception as e:
                # Table query error or no plan found, proceed to generate fresh plan
                pass

        # ---------------------------------------------------------------------
        # STEP 1: Inspect Case Modalities
        # ---------------------------------------------------------------------
        detected_modalities: List[str] = []
        assets_by_modality: Dict[str, List[Dict[str, Any]]] = {}
        has_documents = False

        for asset in assets:
            mod = asset.get("modality", "").lower().strip()
            mime = asset.get("mime_type", "").lower().strip()
            filename = asset.get("filename", "").lower().strip()

            # Normalization
            if mod in self.DOCUMENT_MODALITIES or mime == "application/pdf" or filename.endswith(".pdf"):
                has_documents = True
                norm_mod = "document"
            else:
                norm_mod = mod

            if norm_mod and norm_mod not in detected_modalities:
                detected_modalities.append(norm_mod)

            assets_by_modality.setdefault(norm_mod, []).append(asset)

        # Context text aggregation
        combined_context = (
            f"{symptoms_context or ''} "
            f"{case_metadata.get('chief_complaint', '')} "
            f"{case_metadata.get('clinical_summary', '')} "
            f"{case_metadata.get('initial_impression', '')}"
        ).lower()

        # ---------------------------------------------------------------------
        # STEP 2: Resolve Required Capabilities
        # ---------------------------------------------------------------------
        candidate_capabilities: List[str] = []
        skipped_capabilities: List[Dict[str, Any]] = []

        # All 6 standardized capabilities
        all_capabilities = adapter_registry.list_capabilities()
        all_cap_ids = [c["capability_id"] for c in all_capabilities]

        for cap in all_capabilities:
            cap_id = cap["capability_id"]
            expected_mod = cap["expected_modality"].lower()

            # Check if case has asset matching this expected modality
            compatible_assets = assets_by_modality.get(expected_mod, [])
            if not compatible_assets:
                # Also check CT/MRI fallback for stroke
                if cap_id == "brain_stroke_abnormality_screening" and (
                    assets_by_modality.get("ct") or assets_by_modality.get("mri")
                ):
                    candidate_capabilities.append(cap_id)
                else:
                    skipped_capabilities.append({
                        "capability_id": cap_id,
                        "capability_name": cap["name"],
                        "expected_modality": cap["expected_modality"],
                        "skip_reason": (
                            f"No compatible {cap['expected_modality'].upper()} asset found in case. "
                            f"Capability skipped from execution."
                        ),
                        "status": "skipped_no_asset",
                    })
            else:
                candidate_capabilities.append(cap_id)

        # ---------------------------------------------------------------------
        # STEP 3: Query Model Registry & Capability Adapters
        # ---------------------------------------------------------------------
        candidate_models: List[Dict[str, Any]] = []
        for cap_id in candidate_capabilities:
            cap_meta = adapter_registry.get_capability(cap_id)
            adapter = adapter_registry.get_adapter(cap_id)
            expected_mod = cap_meta["expected_modality"].lower()
            matched_assets = assets_by_modality.get(expected_mod, [])
            if not matched_assets and cap_id == "brain_stroke_abnormality_screening":
                matched_assets = assets_by_modality.get("ct", []) or assets_by_modality.get("mri", [])

            asset = matched_assets[0] if matched_assets else {}

            candidate_models.append({
                "capability_id": cap_id,
                "capability_name": cap_meta["name"],
                "adapter": adapter,
                "cap_meta": cap_meta,
                "asset": asset,
                "status": adapter.status if adapter else "NOT_CONFIGURED",
                "estimated_ram_mb": cap_meta.get("estimated_ram_mb", 512),
                "estimated_latency_ms": cap_meta.get("expected_latency_ms", 500),
            })

        # ---------------------------------------------------------------------
        # STEP 4: Remove / Handle Unavailable Models
        # ---------------------------------------------------------------------
        runnable_candidates: List[Dict[str, Any]] = []
        unconfigured_candidates: List[Dict[str, Any]] = []

        for cand in candidate_models:
            status = cand["status"].upper()
            cap_id = cand["capability_id"]
            cap_name = cand["capability_name"]
            expected_mod = cand["cap_meta"]["expected_modality"]

            if status != "READY":
                cand_copy = dict(cand)
                unconfigured_candidates.append(cand_copy)
                skipped_capabilities.append({
                    "capability_id": cap_id,
                    "capability_name": cap_name,
                    "expected_modality": expected_mod,
                    "skip_reason": (
                        f"Candidate model adapter for '{cap_name}' has status '{status}'. "
                        f"Model weights or runtime dependencies are unconfigured on disk. "
                        f"Execution skipped to strictly prevent simulated/fake predictions."
                    ),
                    "status": "skipped_not_configured",
                })
            else:
                runnable_candidates.append(cand)

        # ---------------------------------------------------------------------
        # STEP 5: Remove Incompatible Models (Preprocessing / Format Checks)
        # ---------------------------------------------------------------------
        compatible_candidates: List[Dict[str, Any]] = []
        for cand in runnable_candidates:
            asset = cand["asset"]
            contract = cand["adapter"].get_preprocessing_contract() if cand["adapter"] else {}
            supported_exts = contract.get("supported_formats", [".png", ".jpg", ".jpeg", ".dcm"])
            filename = asset.get("filename", "").lower()
            
            is_compatible = any(filename.endswith(ext.lower()) for ext in supported_exts) if filename else True
            if not is_compatible:
                skipped_capabilities.append({
                    "capability_id": cand["capability_id"],
                    "capability_name": cand["capability_name"],
                    "expected_modality": cand["cap_meta"]["expected_modality"],
                    "skip_reason": f"Asset '{asset.get('filename')}' does not match supported formats {supported_exts}.",
                    "status": "skipped_incompatible",
                })
            else:
                compatible_candidates.append(cand)

        # ---------------------------------------------------------------------
        # STEP 6: Check Hardware & Memory Resources
        # ---------------------------------------------------------------------
        resource_snapshot = inspect_resource_state()
        resource_checked_candidates: List[Dict[str, Any]] = []

        for cand in compatible_candidates:
            req_ram = cand["estimated_ram_mb"]
            fits, reason = check_resource_fit(required_ram_mb=req_ram, safety_margin_mb=256)
            if not fits:
                skipped_capabilities.append({
                    "capability_id": cand["capability_id"],
                    "capability_name": cand["capability_name"],
                    "expected_modality": cand["cap_meta"]["expected_modality"],
                    "skip_reason": f"Resource constraint: {reason}",
                    "status": "skipped_resource_constraint",
                })
            else:
                cand["resource_fit_note"] = reason
                resource_checked_candidates.append(cand)

        # ---------------------------------------------------------------------
        # STEP 7: Select Models with Deterministic Auditable Rationale
        # ---------------------------------------------------------------------
        selected_models: List[Dict[str, Any]] = []
        selection_reasons: Dict[str, str] = {}

        # 7a. Document & Patient RAG pipeline selection
        if has_documents:
            doc_assets = assets_by_modality.get("document", [])
            doc_filenames = [a.get("filename", "document") for a in doc_assets]
            doc_reason = (
                f"Case includes {len(doc_assets)} clinical document asset(s) ({', '.join(doc_filenames)}). "
                f"Document text extraction and patient-scoped historical RAG pipeline selected for evidence synthesis."
            )
            selection_reasons["document_rag_pipeline"] = doc_reason
            selected_models.append({
                "capability_id": "document_rag_pipeline",
                "capability_name": "Clinical Document & Patient RAG Pipeline",
                "model_id": "gemini-clinical-rag-v1",
                "model_name": "Patient 360 Document RAG Synthesizer",
                "modality": "document",
                "asset_id": doc_assets[0].get("id", ""),
                "asset_filename": doc_assets[0].get("filename", "document.pdf"),
                "status": "ready",
                "estimated_ram_mb": 256,
                "estimated_latency_ms": 750,
                "device": "cpu",
                "selection_reason": doc_reason,
            })

        # 7b. Specialized Medical AI model selection
        for cand in resource_checked_candidates:
            cap_id = cand["capability_id"]
            cap_meta = cand["cap_meta"]
            adapter = cand["adapter"]
            asset = cand["asset"]

            # Symptom relevance detection
            keywords = self.SYMPTOM_KEYWORDS.get(cap_id, [])
            matched_keywords = [kw for kw in keywords if kw in combined_context]
            
            symptom_note = (
                f"Clinical context matches relevant symptoms: [{', '.join(matched_keywords)}]. "
                if matched_keywords
                else "Baseline diagnostic screening indicated by ingested asset modality. "
            )

            reason = (
                f"Modality '{cap_meta['expected_modality']}' verified from asset '{asset.get('filename')}'. "
                f"{symptom_note}"
                f"Candidate model '{adapter.model_id}' is verified and READY. "
                f"Memory check passed: requires {cand['estimated_ram_mb']} MB (available: {resource_snapshot.available_ram_mb} MB). "
                f"Deterministic selection confirmed."
            )

            selection_reasons[cap_id] = reason

            selected_models.append({
                "capability_id": cap_id,
                "capability_name": cap_meta["name"],
                "model_id": adapter.model_id,
                "model_name": cap_meta.get("name", adapter.model_id),
                "modality": cap_meta["expected_modality"],
                "asset_id": asset.get("id", ""),
                "asset_filename": asset.get("filename", ""),
                "status": "ready",
                "estimated_ram_mb": cand["estimated_ram_mb"],
                "estimated_latency_ms": cand["estimated_latency_ms"],
                "device": getattr(adapter, "device", "cpu"),
                "selection_reason": reason,
            })

        # ---------------------------------------------------------------------
        # STEP 8: Build Execution Order & Directed Acyclic Graph (DAG)
        # ---------------------------------------------------------------------
        dag = ExecutionDAG()

        # If document pipeline is selected
        if has_documents:
            dag.add_node(DAGNode(
                id="node_doc_extraction",
                label="Document Text & Structure Extraction",
                node_type="document_pipeline",
                modality="document",
                status="ready",
                estimated_ram_mb=128,
                estimated_latency_ms=300,
            ))
            dag.add_node(DAGNode(
                id="node_doc_rag",
                label="Patient-Scoped RAG Historical Retrieval",
                node_type="document_pipeline",
                modality="document",
                status="ready",
                estimated_ram_mb=256,
                estimated_latency_ms=450,
            ))
            dag.add_edge("node_doc_extraction", "node_doc_rag", relationship="data_flow")

        # Add specialized medical AI nodes
        model_node_ids: List[str] = []
        for model in selected_models:
            if model["capability_id"] == "document_rag_pipeline":
                continue
            node_id = f"node_{model['capability_id']}"
            dag.add_node(DAGNode(
                id=node_id,
                label=model["capability_name"],
                node_type="specialized_model",
                modality=model["modality"],
                status=model["status"],
                capability_id=model["capability_id"],
                model_id=model["model_id"],
                asset_id=model["asset_id"],
                asset_filename=model["asset_filename"],
                estimated_ram_mb=model["estimated_ram_mb"],
                estimated_latency_ms=model["estimated_latency_ms"],
            ))
            model_node_ids.append(node_id)

        # Terminal Evidence Collation Node
        dag.add_node(DAGNode(
            id="node_evidence_collation",
            label="Multimodal Evidence Collation & Uncertainty Check",
            node_type="evidence_synthesis",
            modality="multimodal",
            status="ready",
            estimated_ram_mb=128,
            estimated_latency_ms=200,
        ))

        # Wire dependencies into evidence collation
        if has_documents:
            dag.add_edge("node_doc_rag", "node_evidence_collation", relationship="evidence_fusion")
        for m_id in model_node_ids:
            dag.add_edge(m_id, "node_evidence_collation", relationship="evidence_fusion")

        # Compute topological execution order
        topo_order = dag.topological_sort()
        execution_order: List[Dict[str, Any]] = []
        for idx, node_id in enumerate(topo_order, 1):
            node = dag.nodes.get(node_id)
            if node:
                execution_order.append({
                    "step_number": idx,
                    "node_id": node.id,
                    "label": node.label,
                    "node_type": node.node_type,
                    "modality": node.modality,
                    "status": node.status,
                    "dependencies": node.dependencies,
                })

        # Summary computation
        total_selected = len(selected_models)
        total_skipped = len(skipped_capabilities)
        summary = (
            f"Orchestration Plan Generated: {total_selected} execution unit(s) selected "
            f"({len([m for m in selected_models if m['status'] == 'ready'])} ready, "
            f"{has_documents and 1 or 0} document/RAG), "
            f"{total_skipped} capability(ies) skipped. "
            f"Deterministic execution DAG contains {len(dag.nodes)} nodes across {len(execution_order)} stages."
        )

        plan_record = {
            "id": str(uuid.uuid4()),
            "case_id": case_id,
            "patient_id": patient_id,
            "created_by": created_by,
            "status": "planned",
            "input_modalities": detected_modalities,
            "symptoms_context": symptoms_context,
            "selected_models": selected_models,
            "skipped_capabilities": skipped_capabilities,
            "execution_order": execution_order,
            "dag": dag.to_dict(),
            "selection_reasons": selection_reasons,
            "resource_snapshot": resource_snapshot.to_dict(),
            "summary": summary,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        # ---------------------------------------------------------------------
        # STEP 9: Persist Execution Plan
        # ---------------------------------------------------------------------
        try:
            admin_client.table("orchestration_plans").insert(plan_record).execute()
        except Exception as e:
            # If foreign key constraint on profiles fails, retry without created_by
            if "profiles" in str(e) and plan_record.get("created_by"):
                try:
                    fallback_record = dict(plan_record)
                    fallback_record["created_by"] = None
                    admin_client.table("orchestration_plans").insert(fallback_record).execute()
                except Exception as inner_e:
                    print(f"[ModelOrchestrator] Warning: could not persist plan without created_by: {inner_e}")
            else:
                print(f"[ModelOrchestrator] Warning: could not persist plan to database: {e}")

        return plan_record



# Singleton instance
model_orchestrator = ModelOrchestrator()
