import shutil
import time
from pathlib import Path

from app.config import FRAMES_DIR, VIDEOS_DIR
from app.db import get_connection
from app.ingestion import embed_clip, embed_text
from app.ingestion.frames import extract_frames, get_video_duration
from app.ingestion.transcribe import transcribe_video


def create_video_record(source_path: Path, original_name: str | None = None) -> int:
    """Registers a video and copies it into storage. Fast (no ML work) — safe to
    call inline from a request handler. Actual processing happens separately via
    process_video(), meant to run on the background worker.
    """
    original_name = original_name or source_path.name
    conn = get_connection()
    try:
        # Insert first to get the id, then rename to the id-prefixed filename that
        # actually gets written to disk — process_video() looks the file up later
        # by re-reading this same `filename` column, so it must match reality.
        row = conn.execute(
            "INSERT INTO videos (filename, original_name, status) VALUES (%s, %s, 'pending') RETURNING id",
            (source_path.name, original_name),
        ).fetchone()
        video_id = row[0]

        stored_filename = f"{video_id}_{source_path.name}"
        stored_path = VIDEOS_DIR / stored_filename
        if stored_path != source_path:
            VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source_path, stored_path)

        conn.execute("UPDATE videos SET filename = %s WHERE id = %s", (stored_filename, video_id))
    finally:
        conn.close()

    return video_id


def process_video(video_id: int) -> None:
    """Runs the slow ingestion work (frame extraction, transcription, both sets of
    embeddings) for an already-registered video. Meant to run on the background
    worker thread, not inline with a request.
    """
    conn = get_connection()
    try:
        row = conn.execute("SELECT filename FROM videos WHERE id = %s", (video_id,)).fetchone()
        if row is None:
            raise ValueError(f"No video with id={video_id}")
        stored_path = VIDEOS_DIR / row[0]

        conn.execute("UPDATE videos SET status = 'processing' WHERE id = %s", (video_id,))

        t0 = time.time()
        duration = get_video_duration(stored_path)
        print(f"[video {video_id}] duration={duration:.1f}s")

        frames_dir = FRAMES_DIR / str(video_id)
        frames = extract_frames(stored_path, frames_dir)
        print(f"[video {video_id}] extracted {len(frames)} frames in {time.time() - t0:.1f}s")

        t1 = time.time()
        frame_vecs = embed_clip.embed_images([f.path for f in frames])
        print(f"[video {video_id}] embedded {len(frame_vecs)} frames in {time.time() - t1:.1f}s")

        for frame, vec in zip(frames, frame_vecs):
            rel_path = str(frame.path.relative_to(FRAMES_DIR.parent))
            conn.execute(
                """
                INSERT INTO segments (video_id, type, start_time, end_time, frame_path, frame_embedding)
                VALUES (%s, 'frame', %s, %s, %s, %s)
                """,
                (video_id, frame.timestamp, frame.timestamp, rel_path, vec),
            )

        t2 = time.time()
        chunks = transcribe_video(stored_path)
        print(f"[video {video_id}] transcribed {len(chunks)} chunks in {time.time() - t2:.1f}s")

        if chunks:
            t3 = time.time()
            text_vecs = embed_text.embed_texts([c.text for c in chunks])
            print(f"[video {video_id}] embedded {len(text_vecs)} transcript chunks in {time.time() - t3:.1f}s")

            for chunk, vec in zip(chunks, text_vecs):
                conn.execute(
                    """
                    INSERT INTO segments (video_id, type, start_time, end_time, text, transcript_embedding)
                    VALUES (%s, 'transcript', %s, %s, %s, %s)
                    """,
                    (video_id, chunk.start_time, chunk.end_time, chunk.text, vec),
                )

        conn.execute(
            "UPDATE videos SET status = 'ready', duration_sec = %s WHERE id = %s",
            (duration, video_id),
        )
        print(f"[video {video_id}] done in {time.time() - t0:.1f}s total")

    except Exception as e:
        conn.execute(
            "UPDATE videos SET status = 'failed', error = %s WHERE id = %s",
            (str(e), video_id),
        )
        raise
    finally:
        conn.close()


def ingest_video_file(source_path: Path, original_name: str | None = None) -> int:
    """Convenience wrapper for the CLI: register + process in one blocking call."""
    video_id = create_video_record(source_path, original_name)
    process_video(video_id)
    return video_id


def create_video_record_from_url(url: str) -> int:
    """Registers a video from a URL (e.g. YouTube) without downloading it yet -
    just a quick title lookup. Fast, safe to call inline from a request handler.
    The actual download + processing happens via process_youtube_video(),
    meant to run on the background worker.
    """
    from app.ingestion.youtube import fetch_title

    title = fetch_title(url)
    conn = get_connection()
    try:
        row = conn.execute(
            "INSERT INTO videos (filename, original_name, status) VALUES ('', %s, 'pending') RETURNING id",
            (title,),
        ).fetchone()
        video_id = row[0]
    finally:
        conn.close()

    return video_id


def process_youtube_video(video_id: int, url: str) -> None:
    """Downloads a video from a URL (e.g. YouTube), then runs the normal
    ingestion pipeline on it. Meant to run on the background worker thread.
    """
    from app.ingestion.youtube import download_video

    conn = get_connection()
    try:
        conn.execute("UPDATE videos SET status = 'processing' WHERE id = %s", (video_id,))
        print(f"[video {video_id}] downloading from {url}")
        stored_filename = download_video(video_id, url)
        print(f"[video {video_id}] downloaded to {stored_filename}")
        conn.execute("UPDATE videos SET filename = %s WHERE id = %s", (stored_filename, video_id))
    except Exception as e:
        conn.execute(
            "UPDATE videos SET status = 'failed', error = %s WHERE id = %s",
            (str(e), video_id),
        )
        conn.close()
        return
    conn.close()

    process_video(video_id)
