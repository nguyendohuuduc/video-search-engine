from pathlib import Path

import numpy as np
import open_clip
import torch
from PIL import Image

from app.config import CLIP_MODEL_NAME, CLIP_PRETRAINED

_model = None
_preprocess = None
_tokenizer = None


def _load():
    global _model, _preprocess, _tokenizer
    if _model is None:
        _model, _, _preprocess = open_clip.create_model_and_transforms(CLIP_MODEL_NAME, pretrained=CLIP_PRETRAINED)
        _model.eval()
        _tokenizer = open_clip.get_tokenizer(CLIP_MODEL_NAME)
    return _model, _preprocess, _tokenizer


def _normalize(vec: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vec)
    return vec if norm == 0 else vec / norm


def embed_image(image_path: Path) -> np.ndarray:
    model, preprocess, _ = _load()
    image = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0)
    with torch.no_grad():
        features = model.encode_image(image)
    return _normalize(features.squeeze(0).numpy())


def embed_images(image_paths: list[Path], batch_size: int = 16) -> list[np.ndarray]:
    model, preprocess, _ = _load()
    results: list[np.ndarray] = []
    for i in range(0, len(image_paths), batch_size):
        batch_paths = image_paths[i:i + batch_size]
        batch = torch.stack([preprocess(Image.open(p).convert("RGB")) for p in batch_paths])
        with torch.no_grad():
            features = model.encode_image(batch)
        for vec in features.numpy():
            results.append(_normalize(vec))
    return results


def embed_text(text: str) -> np.ndarray:
    model, _, tokenizer = _load()
    tokens = tokenizer([text])
    with torch.no_grad():
        features = model.encode_text(tokens)
    return _normalize(features.squeeze(0).numpy())


def warmup() -> None:
    """Forces the model to load now rather than on first use."""
    _load()
