import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import FRAMES_DIR, VIDEOS_DIR
from app.db import pool
from app.ingestion import jobs
from app.ingestion.pipeline import create_video_record, create_video_record_from_url

router = APIRouter(prefix="/videos", tags=["videos"])


class YoutubeUploadRequest(BaseModel):
    url: str


def _row_to_dict(row) -> dict:
    return {
        "video_id": row[0],
        "original_name": row[1],
        "video_url": f"/media/videos/{row[6]}",
        "duration_sec": row[2],
        "status": row[3],
        "error": row[4],
        "created_at": row[5].isoformat(),
    }


_SELECT_COLUMNS = "id, original_name, duration_sec, status, error, created_at, filename"


@router.post("")
async def upload_video(file: UploadFile = File(...)):
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir) / file.filename
        with tmp_path.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        video_id = create_video_record(tmp_path, original_name=file.filename)

    jobs.enqueue(video_id)
    return {"video_id": video_id, "status": "pending"}


@router.post("/from-youtube")
def upload_video_from_youtube(req: YoutubeUploadRequest):
    try:
        video_id = create_video_record_from_url(req.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read that URL: {e}")

    jobs.enqueue_youtube(video_id, req.url)
    return {"video_id": video_id, "status": "pending"}


@router.get("")
def list_videos():
    with pool.connection() as conn:
        rows = conn.execute(f"SELECT {_SELECT_COLUMNS} FROM videos ORDER BY id DESC").fetchall()
    return [_row_to_dict(r) for r in rows]


@router.get("/{video_id}")
def get_video(video_id: int):
    with pool.connection() as conn:
        row = conn.execute(
            f"SELECT {_SELECT_COLUMNS} FROM videos WHERE id = %s",
            (video_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Video not found")

    return _row_to_dict(row)


@router.delete("/{video_id}", status_code=204)
def delete_video(video_id: int):
    with pool.connection() as conn:
        row = conn.execute("SELECT filename FROM videos WHERE id = %s", (video_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Video not found")

        # segments rows cascade automatically via the FK's ON DELETE CASCADE
        conn.execute("DELETE FROM videos WHERE id = %s", (video_id,))

    filename = row[0]
    if filename:
        (VIDEOS_DIR / filename).unlink(missing_ok=True)
    shutil.rmtree(FRAMES_DIR / str(video_id), ignore_errors=True)
