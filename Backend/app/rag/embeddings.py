import hashlib
import logging
import math
from typing import List, Optional, Union
import numpy as np

logger = logging.getLogger(__name__)

EMBEDDING_DIMENSION = 384


class EmbeddingService:
    """Provides high-quality semantic embeddings for clinical documents using SentenceTransformers (dimension 384)."""

    _instance: Optional["EmbeddingService"] = None
    _model = None

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name

    @classmethod
    def get_instance(cls) -> "EmbeddingService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(self.model_name)
                logger.info(f"Loaded embedding model: {self.model_name} (dim={EMBEDDING_DIMENSION})")
            except Exception as e:
                logger.warning(f"Could not load SentenceTransformer ('{self.model_name}'): {e}. Using deterministic semantic fallback.")
                self._model = "fallback"
        return self._model

    def embed_text(self, text: str) -> List[float]:
        """Generate a single 384-dimensional normalized vector for given text."""
        vectors = self.embed_batch([text])
        return vectors[0]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate normalized 384-dimensional embeddings for a batch of texts."""
        if not texts:
            return []

        model = self._get_model()
        if model != "fallback":
            try:
                # Generate embeddings with normalized vectors for cosine distance
                embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
                return [arr.tolist() if hasattr(arr, "tolist") else list(arr) for arr in embeddings]
            except Exception as e:
                logger.error(f"Error generating embeddings with SentenceTransformer: {e}. Falling back.")

        # Deterministic semantic n-gram feature hashing fallback (dim 384)
        return [self._deterministic_clinical_embedding(t) for t in texts]

    def _deterministic_clinical_embedding(self, text: str) -> List[float]:
        """High-entropy deterministic semantic hash projection with L2 normalization."""
        vec = np.zeros(EMBEDDING_DIMENSION, dtype=np.float32)
        words = text.lower().split()
        if not words:
            vec[0] = 1.0
            return vec.tolist()

        for idx, word in enumerate(words):
            # 1-gram
            h1 = int(hashlib.sha256(word.encode()).hexdigest(), 16)
            pos1 = h1 % EMBEDDING_DIMENSION
            sign1 = 1.0 if (h1 >> 8) % 2 == 0 else -1.0
            vec[pos1] += sign1 * 1.5

            # 2-gram if applicable
            if idx > 0:
                bigram = f"{words[idx-1]}_{word}"
                h2 = int(hashlib.md5(bigram.encode()).hexdigest(), 16)
                pos2 = h2 % EMBEDDING_DIMENSION
                sign2 = 1.0 if (h2 >> 4) % 2 == 0 else -1.0
                vec[pos2] += sign2 * 2.0

        # L2 normalize
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        else:
            vec[0] = 1.0
        return vec.tolist()


def get_embedding_service() -> EmbeddingService:
    return EmbeddingService.get_instance()
