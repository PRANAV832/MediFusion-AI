import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Type

from app.models.base import MedicalModel
from app.models.chest_xray import (
    ChestXRayDenseNetModel,
    LungOpacityChestXRayAdapter,
    PneumoniaChestXRayAdapter,
)
from app.models.brain_tumor import BrainTumorMRIAdapter
from app.models.brain_stroke import BrainStrokeCTAdapter
from app.models.ecg_arrhythmia import ECGArrhythmiaAdapter
from app.models.skin_lesion import SkinLesionAdapter

logger = logging.getLogger(__name__)


class AdapterRegistry:
    """
    Central clinical AI adapter registry and capability resolver.
    Coordinates adapter discovery, capability resolution, dynamic health checks,
    and runtime model dispatch across the six clinical capabilities.
    """

    def __init__(self):
        self._adapters: Dict[str, MedicalModel] = {}
        self._aliases: Dict[str, str] = {}
        self._capability_meta: Dict[str, Dict[str, Any]] = {}
        self.discover_adapters()

    def discover_adapters(self) -> None:
        """
        Discover and register adapters for all six clinical capabilities:
        1. Brain tumor screening — MRI
        2. Brain/stroke abnormality screening — CT/MRI
        3. Arrhythmia/cardiac abnormality screening — ECG
        4. Pneumonia screening — chest X-ray
        5. Lung opacity/abnormality screening — chest X-ray
        6. Skin-lesion screening — image
        """
        # 1. Brain Tumor Screening (MRI)
        self.register_adapter(
            capability_id="brain_tumor_screening",
            name="Brain Tumor Screening",
            description="Multi-parametric MRI screening for intra-axial and extra-axial intracranial neoplasms (glioma, meningioma, pituitary adenoma).",
            expected_modality="mri",
            adapter_instance=BrainTumorMRIAdapter(),
            model_source="https://github.com/Project-MONAI/research-contributions/tree/main/BraTS21",
            provenance={
                "author": "BraTS / MONAI Consortium",
                "citation": "Bakas et al. Advancing The Cancer Genome Atlas glioma analysis. Scientific Data, 2017.",
                "training_datasets": ["BraTS 2021 Multi-parametric MRI Benchmark", "TCIA TCGA-GBM / TCGA-LGG"],
                "framework": "PyTorch / MONAI"
            },
            license="Apache 2.0 (MONAI Code) / Research Evaluation Only (BraTS Weights)",
        )

        # 2. Brain / Stroke Abnormality Screening (CT / MRI)
        self.register_adapter(
            capability_id="brain_stroke_abnormality_screening",
            name="Brain Stroke & Ischemia Abnormality Screening",
            description="Detection of acute ischemic core, middle cerebral artery (MCA) territory hypodensity, and early ischemic changes (ASPECTS) on head CT.",
            expected_modality="ct",
            adapter_instance=BrainStrokeCTAdapter(),
            model_source="https://github.com/MIC-DKFZ/nnUNet / Pretrained AIS-NCCT Stroke Model",
            provenance={
                "author": "Clinical Neurovascular AI Research Consortium",
                "citation": "Korfiatis et al. Automated Detection of Early Ischemic Changes on Noncontrast CT in Acute Stroke. Radiology, 2021.",
                "training_datasets": ["Multicenter Acute Stroke NCCT Registry (n=2,480)", "ISLES Stroke Challenge"],
                "framework": "PyTorch / nnUNet"
            },
            license="Academic Evaluation License / Non-Commercial Clinical Research",
            aliases=["stroke_ischemia_screening"],
        )

        # 3. Arrhythmia / Cardiac Abnormality Screening (ECG)
        self.register_adapter(
            capability_id="arrhythmia_cardiac_abnormality_screening",
            name="Arrhythmia & Cardiac Abnormality Screening",
            description="Automated 12-lead electrocardiogram (ECG) screening across diagnostic superclasses including myocardial infarction, conduction blocks, and rhythm abnormalities.",
            expected_modality="ecg",
            adapter_instance=ECGArrhythmiaAdapter(),
            model_source="https://physionet.org/content/ptb-xl/1.0.3/ / PTB-XL Benchmark Models",
            provenance={
                "author": "Wagner et al. / PhysioNet PTB-XL Consortium",
                "citation": "Wagner et al. PTB-XL, a large publicly available electrocardiography dataset. Scientific Data 7, 154 (2020).",
                "training_datasets": ["PTB-XL 12-lead ECG Dataset (n=21,837 patients, 71 diagnostic statements)"],
                "framework": "PyTorch (1D ResNet-101 / FastAI ECG)"
            },
            license="PhysioNet Credentialed Health Data License / CC BY 4.0",
            aliases=["arrhythmia_screening"],
        )

        # 4. Pneumonia Screening (Chest X-Ray)
        self.register_adapter(
            capability_id="pneumonia_screening",
            name="Pneumonia Screening",
            description="Screening and probability quantification of infectious pneumonia, consolidation, and airspace opacification on frontal chest radiographs.",
            expected_modality="chest_xray",
            adapter_instance=PneumoniaChestXRayAdapter(),
            model_source="https://github.com/mlmed/torchxrayvision (densenet121-res224-all)",
            provenance={
                "author": "Joseph Paul Cohen et al.",
                "citation": "Cohen et al. TorchXRayVision: A library of chest X-ray datasets and models. MIDL 2022. arXiv:2002.02497",
                "training_datasets": ["RSNA Pneumonia Challenge", "NIH ChestX-ray14", "CheXpert", "MIMIC-CXR", "PadChest"],
                "framework": "TorchXRayVision / PyTorch"
            },
            license="Apache 2.0 (Code) / Academic & Non-Commercial Clinical Evaluation (Weights)",
        )

        # 5. Lung Opacity / Abnormality Screening (Chest X-Ray)
        self.register_adapter(
            capability_id="lung_opacity_abnormality_screening",
            name="Lung Opacity & Thoracic Abnormality Screening",
            description="Comprehensive multi-pathology screening across 18 frontal thoracic radiograph abnormalities including lung opacities, pleural effusions, atelectasis, pneumothorax, and cardiomegaly.",
            expected_modality="chest_xray",
            adapter_instance=LungOpacityChestXRayAdapter(),
            model_source="https://github.com/mlmed/torchxrayvision (densenet121-res224-all)",
            provenance={
                "author": "Joseph Paul Cohen et al.",
                "citation": "Cohen et al. TorchXRayVision: A library of chest X-ray datasets and models. MIDL 2022. arXiv:2002.02497",
                "training_datasets": ["NIH ChestX-ray14", "CheXpert", "MIMIC-CXR", "PadChest", "Google Health OpenI"],
                "framework": "TorchXRayVision / PyTorch"
            },
            license="Apache 2.0 (Code) / Academic & Non-Commercial Clinical Evaluation (Weights)",
            aliases=["lung_opacity_screening", "chest_xray_screening"],
        )

        # 6. Skin-Lesion Screening (Image)
        self.register_adapter(
            capability_id="skin_lesion_screening",
            name="Skin Lesion & Melanoma Screening",
            description="Dermatoscopic digital photography screening for pigmentary abnormalities, melanoma, basal cell carcinoma, and benign keratoses.",
            expected_modality="skin_image",
            adapter_instance=SkinLesionAdapter(),
            model_source="https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/DBW86T / HAM10000 Benchmark",
            provenance={
                "author": "Tschandl et al. / ViDIR Group Medical University of Vienna",
                "citation": "Tschandl et al. The HAM10000 dataset, a large collection of multi-source dermatoscopic images. Sci Data 5, 180161 (2018).",
                "training_datasets": ["HAM10000 (10,015 dermatoscopic images)"],
                "framework": "PyTorch (EfficientNet-B0 / ResNet-50)"
            },
            license="CC BY-NC 4.0 (HAM10000 Dataset & Benchmark Models)",
        )

        logger.info(
            "Discovered and registered %d clinical capability adapters with %d aliases",
            len(self._adapters),
            len(self._aliases),
        )

    def register_adapter(
        self,
        capability_id: str,
        name: str,
        description: str,
        expected_modality: str,
        adapter_instance: MedicalModel,
        model_source: str,
        provenance: Dict[str, Any],
        license: str,
        aliases: Optional[List[str]] = None,
    ) -> None:
        """Register a capability adapter and its clinical metadata."""
        self._adapters[capability_id] = adapter_instance
        self._capability_meta[capability_id] = {
            "capability_id": capability_id,
            "name": name,
            "description": description,
            "expected_modality": expected_modality,
            "adapter_class": adapter_instance.adapter_class_name,
            "preprocessing_contract": adapter_instance.get_preprocessing_contract(),
            "output_schema": adapter_instance.get_output_schema(),
            "model_source": model_source,
            "provenance": provenance,
            "limitations": adapter_instance.get_limitations(),
            "license": license,
            "model_id": adapter_instance.model_id,
        }

        if aliases:
            for alias in aliases:
                self._aliases[alias] = capability_id

    def has_capability(self, capability_id: str) -> bool:
        canonical_id = self._aliases.get(capability_id, capability_id)
        return canonical_id in self._adapters

    def get_adapter(self, capability_id: str) -> Optional[MedicalModel]:
        """Resolve adapter instance by capability ID or alias."""
        canonical_id = self._aliases.get(capability_id, capability_id)
        return self._adapters.get(canonical_id)

    def get_capability_metadata(self, capability_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve capability metadata with dynamic status and verification checklist."""
        canonical_id = self._aliases.get(capability_id, capability_id)
        meta = self._capability_meta.get(canonical_id)
        if not meta:
            return None

        adapter = self._adapters.get(canonical_id)
        verification = adapter.verify() if adapter else {"verified": False, "status": "NOT_CONFIGURED", "failure_reasons": ["Adapter not registered"]}
        status_val = "ready" if verification.get("verified", False) else "not_configured"

        result = dict(meta)
        result["status"] = status_val
        result["verification_details"] = verification
        return result

    get_capability = get_capability_metadata

    def list_capabilities(self) -> List[Dict[str, Any]]:
        """List all registered capabilities with live status and verification details."""
        results = []
        for cap_id in self._capability_meta.keys():
            meta = self.get_capability_metadata(cap_id)
            if meta:
                results.append(meta)
        return results

    def resolve_capabilities(
        self,
        modality: str,
        runnable_only: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Capability Resolver:
        Maps input modality to compatible clinical capabilities.
        If runnable_only=True, filters to only capabilities with verified status == 'ready'.
        Supports multi-modality matches (e.g. brain stroke is compatible with CT and MRI).
        """
        matched = []
        modality_lower = modality.lower()

        for cap_id, meta in self._capability_meta.items():
            expected = meta["expected_modality"].lower()
            is_compatible = False

            if expected == modality_lower:
                is_compatible = True
            elif expected == "ct" and modality_lower in ("ct", "mri") and "stroke" in cap_id:
                is_compatible = True
            elif expected == "chest_xray" and modality_lower in ("chest_xray", "xray"):
                is_compatible = True
            elif expected == "skin_image" and modality_lower in ("skin_image", "image", "dermoscopy"):
                is_compatible = True

            if is_compatible:
                full_meta = self.get_capability_metadata(cap_id)
                if full_meta:
                    if runnable_only and full_meta["status"] != "ready":
                        continue
                    matched.append(full_meta)

        # Sort: runnable first, then alphabetically
        matched.sort(key=lambda m: (m["status"] != "ready", m["name"]))
        return matched

    def check_health(self, capability_id: str) -> Dict[str, Any]:
        """Run real-time dynamic verification on a capability."""
        canonical_id = self._aliases.get(capability_id, capability_id)
        adapter = self._adapters.get(canonical_id)
        now_iso = datetime.now(timezone.utc).isoformat()

        if not adapter:
            return {
                "capability_id": capability_id,
                "status": "NOT_CONFIGURED",
                "runtime_ready": False,
                "device": "none",
                "weights_present": False,
                "dependencies_ready": False,
                "verification_details": {
                    "verified": False,
                    "failure_reasons": [f"Capability '{capability_id}' not found in registry."]
                },
                "last_verified_at": now_iso,
            }

        verification = adapter.verify()
        checklist = verification.get("checklist", {})
        weights_info = checklist.get("weights", {})
        deps_info = checklist.get("dependencies", {})

        return {
            "capability_id": canonical_id,
            "status": verification.get("status", "NOT_CONFIGURED"),
            "runtime_ready": verification.get("verified", False),
            "device": adapter.device,
            "weights_present": weights_info.get("verified", False),
            "dependencies_ready": deps_info.get("verified", False),
            "verification_details": verification,
            "last_verified_at": now_iso,
        }


# Global adapter registry singleton
adapter_registry = AdapterRegistry()
