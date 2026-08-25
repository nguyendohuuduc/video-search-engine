from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import FRAMES_DIR, VIDEOS_DIR
from app.db import init_schema, pool
from app.ingestion import embed_clip, embed_text, jobs, transcribe
from app.routers import search, videos


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_schema()
    pool.open()

    print("Loading models...")
    embed_clip.warmup()
    embed_text.warmup()
    transcribe.warmup()
    print("Models loaded.")

    jobs.start_worker()

    yield

    pool.close()


app = FastAPI(title="video-search-engine", lifespan=lifespan)

app.include_router(videos.router, prefix="/api")
app.include_router(search.router, prefix="/api")

VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
FRAMES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media/videos", StaticFiles(directory=VIDEOS_DIR), name="videos")
app.mount("/media/frames", StaticFiles(directory=FRAMES_DIR), name="frames")
