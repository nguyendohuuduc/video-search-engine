import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.db import pool
from app.ingestion import jobs
from app.ingestion.pipeline import create_video_record

router = APIRouter(prefix="/videos", tags=["videos"])


def _row_to_dict(row) -> dict:
    return {
        "video_id": row[0],
        "original_name": row[1],
        "duration_sec": row[2],
        "status": row[3],
        "error": row[4],
        "created_at": row[5].isoformat(),
    }


@router.post("")
async def upload_video(file: UploadFile = File(...)):
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir) / file.filename
        with tmp_path.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        video_id = create_video_record(tmp_path, original_name=file.filename)

    jobs.enqueue(video_id)
    return {"video_id": video_id, "status": "pending"}


@router.get("")
def list_videos():
    with pool.connection() as conn:
        rows = conn.execute(
            "SELECT id, original_name, duration_sec, status, error, created_at FROM videos ORDER BY id DESC"
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


@router.get("/{video_id}")
def get_video(video_id: int):
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT id, original_name, duration_sec, status, error, created_at FROM videos WHERE id = %s",
            (video_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Video not found")

    return _row_to_dict(row)
