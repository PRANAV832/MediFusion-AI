import logging
import os
import pathlib
import time
from typing import Dict, Optional, Union
import torch

from app.models.base import MedicalModel
from app.models.chest_xray import ChestXRayDenseNetModel, DEFAULT_WEIGHTS_FILENAME
from app.models.registry import adapter_registry
from app.schemas.model_run import (
    ModelFinding,
    ModelStatusEnum,
    ModelStatusResponse,
    NormalizedInferenceResult,
)

logger = logging.getLogger(__name__)


class ModelLifecycleManager:
    """
    Manages the lifecycle, memory footprint, runtime execution, and status transitions
    of clinical medical models and adapters across the six-capability architecture.
    """

    def __init__(self):
        self._models: Dict[str, MedicalModel] = {}
        self._last_error: Dict[str, str] = {}

    def get_status(self, model_id: str = "torchxrayvision-densenet121", target_id: Optional[str] = None) -> ModelStatusResponse:
        """
        Inspect runtime dependencies, hardware accelerators, weights availability,
        and current lifecycle state for a model ID or capability ID.
        """
        effective_id = target_id or model_id
        # 1. Try capability resolution
        adapter = adapter_registry.get_adapter(effective_id)
        if adapter:
            report = adapter.verify()
            checklist = report.get("checklist", {})
            weights_info = checklist.get("weights", {})
            deps_info = checklist.get("dependencies", {})
            verified = report.get("verified", False)

            status_enum = ModelStatusEnum.READY if verified else ModelStatusEnum.NOT_CONFIGURED
            status_msg = (
                "Model is verified and ready for real specialized clinical inference."
                if verified
                else f"Capability is NOT_CONFIGURED: {'; '.join(report.get('failure_reasons', []))}"
            )

            pathologies = getattr(adapter, "pathologies", [])
            if not pathologies and hasattr(adapter, "get_output_schema"):
                schema = adapter.get_output_schema()
                pathologies = schema.get("targets", schema.get("classes", []))

            return ModelStatusResponse(
                model_id=adapter.model_id,
                model_version=adapter.model_version,
                capability=adapter.capability,
                status=status_enum,
                status_message=status_msg,
                device=adapter.device if verified else "none",
                gpu_available=torch.cuda.is_available(),
                weights_available=weights_info.get("verified", False),
                dependencies_installed=deps_info.get("verified", False),
                pathologies=pathologies,
                limitations=adapter.get_limitations(),
            )

        # 2. Legacy check for torchxrayvision-densenet121 directly
        if effective_id == "torchxrayvision-densenet121":
            try:
                import torchxrayvision as xrv
                dependencies_installed = True
            except ImportError:
                dependencies_installed = False

            weights_dir = pathlib.Path.home() / ".torchxrayvision" / "models_data"
            weights_file = weights_dir / DEFAULT_WEIGHTS_FILENAME
            weights_available = weights_file.exists() and weights_file.stat().st_size > 0

            if not dependencies_installed or not weights_available:
                return ModelStatusResponse(
                    model_id=effective_id,
                    model_version="densenet121-res224-all",
                    capability="chest_xray_screening",
                    status=ModelStatusEnum.NOT_CONFIGURED,
                    status_message="Weights or dependencies missing for TorchXRayVision DenseNet-121.",
                    device="none",
                    gpu_available=torch.cuda.is_available(),
                    weights_available=weights_available,
                    dependencies_installed=dependencies_installed,
                    pathologies=[],
                    limitations=[],
                )

            return ModelStatusResponse(
                model_id=effective_id,
                model_version="densenet121-res224-all",
                capability="chest_xray_screening",
                status=ModelStatusEnum.READY,
                status_message="Model is loaded and ready for real specialized clinical inference.",
                device="cuda" if torch.cuda.is_available() else "cpu",
                gpu_available=torch.cuda.is_available(),
                weights_available=True,
                dependencies_installed=True,
                pathologies=[
                    "Atelectasis", "Consolidation", "Infiltration", "Pneumothorax",
                    "Edema", "Emphysema", "Fibrosis", "Effusion", "Pneumonia",
                    "Pleural_Thickening", "Cardiomegaly", "Nodule", "Mass", "Hernia",
                    "Lung Lesion", "Fracture", "Lung Opacity", "Enlarged Cardiomediastinum",
                ],
                limitations=[
                    "Investigational Decision Support: Screening support only, not an autonomous diagnostic device.",
                    "PA/AP Projection Requirement: Calibrated strictly on frontal chest views.",
                    "Downsampled Spatial Resolution: Processed at 224x224 pixels.",
                ],
            )

        # Default fallback for unconfigured unknown IDs
        return ModelStatusResponse(
            model_id=effective_id,
            model_version="unknown",
            capability="unsupported",
            status=ModelStatusEnum.NOT_CONFIGURED,
            status_message=f"Target '{effective_id}' is not configured in the model registry.",
            device="none",
            gpu_available=torch.cuda.is_available(),
            weights_available=False,
            dependencies_installed=False,
            pathologies=[],
            limitations=[],
        )

    def get_or_load_adapter(self, capability_or_model_id: str) -> MedicalModel:
        """
        Retrieves active model/adapter from cache or loads into memory.
        Enforces strict verification: If not verified, raises an explicit exception.
        """
        adapter = adapter_registry.get_adapter(capability_or_model_id)
        if not adapter:
            if capability_or_model_id == "torchxrayvision-densenet121":
                adapter = adapter_registry.get_adapter("lung_opacity_abnormality_screening")
            else:
                raise ValueError(f"Capability or model '{capability_or_model_id}' is not recognized in registry.")

        if not adapter:
            raise ValueError(f"Could not resolve adapter for '{capability_or_model_id}'.")

        report = adapter.verify()
        if not report.get("verified", False):
            reasons = "; ".join(report.get("failure_reasons", ["Verification failed"]))
            raise ValueError(
                f"Capability '{capability_or_model_id}' status is NOT_CONFIGURED ({reasons}). "
                f"Inference cannot be executed. Fake predictions are strictly prohibited."
            )

        if not adapter.is_loaded:
            adapter.load()

        return adapter

    def get_or_load_model(self, model_id: str = "torchxrayvision-densenet121") -> MedicalModel:
        """Legacy helper for backward compatibility."""
        return self.get_or_load_adapter(model_id)

    def run_capability_inference(
        self,
        asset_bytes: bytes,
        asset_id: str,
        capability_id: str,
        filename: Optional[str] = None,
        asset_sha256: Optional[str] = None,
    ) -> NormalizedInferenceResult:
        """
        Execute end-to-end specialized medical inference through the resolved capability adapter.
        Only executes if model is verified and READY. Zero fake predictions.
        """
        adapter = self.get_or_load_adapter(capability_id)

        start_time = time.perf_counter()
        preprocessed = adapter.preprocess(asset_bytes)
        raw_output = adapter.predict(preprocessed)
        end_time = time.perf_counter()
        runtime_ms = (end_time - start_time) * 1000.0

        result = adapter.postprocess(
            raw_predictions=raw_output,
            input_asset_id=asset_id,
            runtime_ms=runtime_ms,
            input_asset_filename=filename,
            input_asset_sha256=asset_sha256,
        )
        return result

    def run_inference(
        self,
        asset_bytes: bytes,
        asset_id: str,
        filename: Optional[str] = None,
        asset_sha256: Optional[str] = None,
        model_id: str = "torchxrayvision-densenet121",
    ) -> NormalizedInferenceResult:
        """Backward-compatible inference execution."""
        return self.run_capability_inference(
            asset_bytes=asset_bytes,
            asset_id=asset_id,
            capability_id=model_id,
            filename=filename,
            asset_sha256=asset_sha256,
        )

    def unload(self, target_id: str) -> None:
        """Unload specific adapter from memory."""
        adapter = adapter_registry.get_adapter(target_id)
        if adapter and adapter.is_loaded:
            adapter.unload()

    def unload_all(self) -> None:
        """Unload all active models across the registry."""
        for cap in adapter_registry.list_capabilities():
            adapter = adapter_registry.get_adapter(cap["capability_id"])
            if adapter and adapter.is_loaded:
                adapter.unload()


# Global singleton instance
model_manager = ModelLifecycleManager()

