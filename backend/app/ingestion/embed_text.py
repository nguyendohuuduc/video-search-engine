import numpy as np
from sentence_transformers import SentenceTransformer

from app.config import TEXT_MODEL_NAME

_model: SentenceTransformer | None = None


def _load() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(TEXT_MODEL_NAME)
    return _model


def embed_text(text: str) -> np.ndarray:
    model = _load()
    vec = model.encode(text, normalize_embeddings=True)
    return vec


def embed_texts(texts: list[str]) -> list[np.ndarray]:
    model = _load()
    vecs = model.encode(texts, normalize_embeddings=True)
    return list(vecs)
