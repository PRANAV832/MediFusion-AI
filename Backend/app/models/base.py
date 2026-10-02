from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from app.schemas.model_run import NormalizedInferenceResult


class MedicalModel(ABC):
    """
    Abstract base class for all specialized clinical AI models and adapters in MediFusion.
    Enforces standardized lifecycle management, rigorous preprocessing, 
    real inference, and normalized structured outputs with clinical provenance.
    Strictly forbids simulated, fake, or mock predictions.
    """

    def __init__(
        self,
        model_id: str,
        model_version: str,
        capability: str,
        expected_modality: str = "chest_xray",
        device: Optional[str] = None,
    ):
        self.model_id = model_id
        self.model_version = model_version
        self.capability = capability
        self.expected_modality = expected_modality
        self.device = device or "cpu"
        self._is_loaded = False
        self._model = None

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded

    @property
    def adapter_class_name(self) -> str:
        return self.__class__.__name__

    @abstractmethod
    def verify(self) -> Dict[str, Any]:
        """
        Verify the candidate model across 9 mandatory clinical AI criteria:
        1. license
        2. input contract
        3. preprocessing contract
        4. labels
        5. outputs schema
        6. weights presence on disk
        7. dependencies installed
        8. documented limitations
        9. hardware requirements

        Returns verification report with 'verified' boolean and 'status' ('READY' or 'NOT_CONFIGURED').
        """
        pass

    @property
    def status(self) -> str:
        """Dynamic operational status based on live verification."""
        report = self.verify()
        return "ready" if report.get("verified", False) else "not_configured"

    @abstractmethod
    def load(self) -> None:
        """
        Load weights and initialize runtime dependencies into memory.
        Must raise an explicit exception if weights or dependencies are unavailable.
        """
        pass

    @abstractmethod
    def preprocess(self, input_data: Any, **kwargs) -> Any:
        """
        Transform raw input (bytes, image array, or tensor) into the exact numerical
        tensor format required by the model architecture.
        """
        pass

    @abstractmethod
    def predict(self, preprocessed_data: Any) -> Any:
        """
        Execute real model inference without hallucination or mock fallbacks.
        Returns raw model logits or tensor predictions.
        """
        pass

    @abstractmethod
    def postprocess(self, raw_predictions: Any, **kwargs) -> NormalizedInferenceResult:
        """
        Convert raw tensor predictions/logits into normalized clinical findings,
        operating threshold decisions, scores, and complete provenance metadata.
        """
        pass

    @abstractmethod
    def unload(self) -> None:
        """
        Safely purge model weights and free CPU/VRAM memory.
        """
        pass

    @abstractmethod
    def get_limitations(self) -> List[str]:
        """
        Return documented clinical contraindications and technical limitations.
        """
        pass

    @abstractmethod
    def get_preprocessing_contract(self) -> Dict[str, Any]:
        """Return standardized input preprocessing dimensions, normalization, and formats."""
        pass

    @abstractmethod
    def get_output_schema(self) -> Dict[str, Any]:
        """Return target classes, metrics, decision thresholds, and prediction types."""
        pass

