from dataclasses import dataclass
from pathlib import Path

from faster_whisper import WhisperModel

from app.config import (
    CHUNK_PAUSE_BREAK_SEC,
    CHUNK_WINDOW_SEC,
    WHISPER_COMPUTE_TYPE,
    WHISPER_DEVICE,
    WHISPER_MODEL,
)

_model: WhisperModel | None = None


def get_whisper_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(WHISPER_MODEL, device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE_TYPE)
    return _model


def warmup() -> None:
    """Forces the model to load now rather than on first use."""
    get_whisper_model()


@dataclass
class TranscriptChunk:
    text: str
    start_time: float
    end_time: float


def transcribe_video(video_path: Path) -> list[TranscriptChunk]:
    model = get_whisper_model()
    segments, _info = model.transcribe(str(video_path), vad_filter=True)

    chunks: list[TranscriptChunk] = []
    current_texts: list[str] = []
    chunk_start: float | None = None
    prev_end: float | None = None

    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue

        pause = seg.start - prev_end if prev_end is not None else 0.0
        window_len = seg.end - chunk_start if chunk_start is not None else 0.0

        should_flush = current_texts and (pause > CHUNK_PAUSE_BREAK_SEC or window_len > CHUNK_WINDOW_SEC)
        if should_flush:
            chunks.append(TranscriptChunk(
                text=" ".join(current_texts),
                start_time=chunk_start,
                end_time=prev_end,
            ))
            current_texts = []
            chunk_start = None

        if chunk_start is None:
            chunk_start = seg.start
        current_texts.append(text)
        prev_end = seg.end

    if current_texts:
        chunks.append(TranscriptChunk(
            text=" ".join(current_texts),
            start_time=chunk_start,
            end_time=prev_end,
        ))

    return chunks
