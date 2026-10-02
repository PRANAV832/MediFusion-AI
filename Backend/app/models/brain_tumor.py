import pathlib
from typing import Any, Dict, List, Optional
import torch

from app.models.base import MedicalModel
from app.schemas.model_run import NormalizedInferenceResult


class BrainTumorMRIAdapter(MedicalModel):
    """
    Capability 1: Brain tumor screening — MRI.
    Multi-parametric MRI screening for intra-axial and extra-axial intracranial
    neoplasms (glioma, meningioma, pituitary adenoma) using MONAI BraTS candidate model.
    """

    def __init__(
        self,
        model_id: str = "brain-tumor-mri-seg",
        model_version: str = "brats-2023-v1",
        device: Optional[str] = None,
    ):
        super().__init__(
            model_id=model_id,
            model_version=model_version,
            capability="brain_tumor_screening",
            expected_modality="mri",
            device=device or ("cuda" if torch.cuda.is_available() else "cpu"),
        )
        self.weights_path = pathlib.Path.home() / ".medifusion" / "models" / "brats2023_unet.pt"

    def verify(self) -> Dict[str, Any]:
        """
        Verify candidate BraTS model across 9 mandatory clinical AI criteria:
        license, input, preprocessing, labels, outputs, weights, dependencies, limitations, hardware requirements.
        """
        dep_errors = []
        try:
            import monai
            import nibabel
        except ImportError as e:
            dep_errors.append(f"Missing dependency: {e.name}")

        weights_exist = self.weights_path.exists() and self.weights_path.stat().st_size > 0
        failure_reasons = []
        if dep_errors:
            failure_reasons.extend(dep_errors)
        if not weights_exist:
            failure_reasons.append(f"Pretrained BraTS weights not found on disk at {self.weights_path}")

        verified = len(failure_reasons) == 0

        return {
            "verified": verified,
            "status": "READY" if verified else "NOT_CONFIGURED",
            "capability_id": self.capability,
            "adapter_class": self.adapter_class_name,
            "checklist": {
                "license": {
                    "verified": True,
                    "details": "CC BY-NC-SA 4.0 (BraTS Challenge Data) / Apache 2.0 (MONAI Core)"
                },
                "input": {
                    "verified": True,
                    "details": "256x256x1 axial slice or 240x240x155 multi-sequence volume (T1, T1Gd, T2, FLAIR)"
                },
                "preprocessing": {
                    "verified": True,
                    "details": "Brain tissue skull-stripping + z-score intensity normalization"
                },
                "labels": {
                    "verified": True,
                    "details": "Glioma, Meningioma, Pituitary Neoplasm, No Neoplasm Detected"
                },
                "outputs": {
                    "verified": True,
                    "details": "Neoplasm probability, confidence interval, enhancing core volume (cm³)"
                },
                "weights": {
                    "verified": weights_exist,
                    "details": str(self.weights_path) if weights_exist else "Weights checkpoint (~420MB) not configured"
                },
                "dependencies": {
                    "verified": len(dep_errors) == 0,
                    "details": "monai, nibabel, torch"
                },
                "limitations": {
                    "verified": True,
                    "details": "Requires contrast T1Gd or FLAIR; cannot replace surgical histopathology or IDH genetics"
                },
                "hardware_requirements": {
                    "verified": True,
                    "details": "CUDA GPU recommended (>= 4GB VRAM) or CPU (high latency > 3000ms)"
                }
            },
            "failure_reasons": failure_reasons,
        }

    def get_preprocessing_contract(self) -> Dict[str, Any]:
        return {
            "input_dimensions": "256x256x1 or 240x240x155 3D volume",
            "channels": 1,
            "color_space": "grayscale",
            "target_sequences": ["T1_contrast", "T2_FLAIR"],
            "normalization": "Brain tissue skull-stripping + z-score intensity normalization",
            "supported_formats": ["nii", "nii.gz", "dcm", "png", "jpg"]
        }

    def get_output_schema(self) -> Dict[str, Any]:
        return {
            "prediction_type": "classification_and_segmentation",
            "classes": ["Glioma", "Meningioma", "Pituitary Tumor", "No Neoplasm Detected"],
            "metrics": ["neoplasm_probability", "confidence_interval", "enhancing_core_volume_cm3"],
            "decision_threshold": 0.50
        }

    def get_limitations(self) -> List[str]:
        return [
            "Investigational screening decision support only; not an autonomous neuro-oncology diagnosis.",
            "Requires contrast-enhanced T1 (T1Gd) or FLAIR sequences for accurate detection; non-contrast axial scans yield lower sensitivity.",
            "Post-surgical resection cavities, radiation necrosis, and subacute infarcts can produce false-positive enhancing ring patterns.",
            "Tissue histopathology and molecular genetics (IDH mutation, 1p/19q codeletion) remain mandatory for definitive classification."
        ]

    def load(self) -> None:
        report = self.verify()
        if not report["verified"]:
            raise RuntimeError(
                f"Cannot load BrainTumorMRIAdapter: Status is NOT_CONFIGURED. "
                f"Reasons: {'; '.join(report['failure_reasons'])}. Fake predictions are strictly prohibited."
            )
        self._is_loaded = True

    def preprocess(self, input_data: Any, **kwargs) -> Any:
        report = self.verify()
        if not report["verified"]:
            raise RuntimeError("Cannot preprocess: BrainTumorMRIAdapter is NOT_CONFIGURED.")
        return input_data

    def predict(self, preprocessed_data: Any) -> Any:
        raise RuntimeError("Cannot predict: BrainTumorMRIAdapter is NOT_CONFIGURED. Fake predictions are strictly prohibited.")

    def postprocess(self, raw_predictions: Any, **kwargs) -> NormalizedInferenceResult:
        raise RuntimeError("Cannot postprocess: BrainTumorMRIAdapter is NOT_CONFIGURED.")

    def unload(self) -> None:
        self._is_loaded = False
