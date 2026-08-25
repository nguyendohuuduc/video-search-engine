from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
VIDEOS_DIR = DATA_DIR / "videos"
FRAMES_DIR = DATA_DIR / "frames"

DATABASE_URL = "postgresql://duc@localhost:5544/videosearch"

# Frame sampling
FRAME_SAMPLE_INTERVAL_SEC = 1.0

# Whisper
WHISPER_MODEL = "base"
WHISPER_DEVICE = "cpu"
WHISPER_COMPUTE_TYPE = "int8"

# Transcript chunking
CHUNK_WINDOW_SEC = 20.0
CHUNK_PAUSE_BREAK_SEC = 1.5

# Embedding models
CLIP_MODEL_NAME = "ViT-B-32-quickgelu"  # OpenAI's original checkpoint uses QuickGELU; the plain "ViT-B-32" config defaults to GELU and silently mismatches these weights
CLIP_PRETRAINED = "openai"
CLIP_EMBED_DIM = 512

TEXT_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
TEXT_EMBED_DIM = 384
