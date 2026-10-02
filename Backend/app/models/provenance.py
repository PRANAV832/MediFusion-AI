import hashlib
import os
import pathlib
from datetime import datetime, timezone
from typing import List, Optional
import torch
import torchxrayvision as xrv
from app.schemas.model_run import ModelProvenance


def compute_sha256(data: bytes) -> str:
    """Compute standard SHA-256 hexadecimal hash for raw bytes."""
    return hashlib.sha256(data).hexdigest()


def compute_file_sha256(file_path: str) -> Optional[str]:
    """Compute standard SHA-256 for a file on disk if it exists."""
    p = pathlib.Path(file_path)
    if not p.exists() or not p.is_file():
        return None
    sha256_hash = hashlib.sha256()
    with open(p, "rb") as f:
        for byte_block in iter(lambda: f.read(65536), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def build_chest_xray_provenance(
    weights_path: Optional[str],
    input_asset_filename: Optional[str] = None,
    input_asset_sha256: Optional[str] = None,
    device: str = "cpu",
) -> ModelProvenance:
    """
    Constructs an auditable provenance object for TorchXRayVision DenseNet-121 model execution.
    """
    weights_hash = None
    if weights_path and os.path.exists(weights_path):
        weights_hash = compute_file_sha256(weights_path)

    return ModelProvenance(
        model_name="TorchXRayVision DenseNet-121",
        architecture="DenseNet-121 (densenet121-res224-all)",
        weights_source="https://github.com/mlmed/torchxrayvision/releases/download/v1/nih-pc-chex-mimic_ch-google-openi-kaggle-densenet121-d121-tw-lr001-rot45-tr15-sc15-seed0-best.pt",
        weights_hash=weights_hash,
        training_datasets=[
            "NIH ChestX-ray14",
            "PadChest (PC)",
            "CheXpert",
            "MIMIC-CXR",
            "Google Health OpenI",
            "RSNA Pneumonia Challenge",
        ],
        citation="Cohen et al. TorchXRayVision: A library of chest X-ray datasets and models. MIDL 2022. arXiv:2002.02497",
        license="Code: Apache 2.0; Weights: Academic/Research & Non-Commercial Clinical Evaluation",
        input_dimensions="224x224x1 (single-channel grayscale)",
        normalization_range="[-1024.0, 1024.0] (scaled via xrv.datasets.normalize)",
        input_asset_filename=input_asset_filename,
        input_asset_sha256=input_asset_sha256,
        execution_timestamp=datetime.now(timezone.utc).isoformat(),
        torch_version=torch.__version__,
        torchxrayvision_version=xrv.__version__,
        device=device,
    )
