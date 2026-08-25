"""Standalone test of the ingestion pipeline against the real Postgres db.

Usage:
    python -m app.cli.ingest_video path/to/video.mp4
    python -m app.cli.ingest_video path/to/folder/
    python -m app.cli.ingest_video path/to/video.mp4 --check "a race car" "a dog"
    python -m app.cli.ingest_video path/to/folder/ --check "a race car" "a dog"

If given a folder, every video file directly inside it (non-recursive) is
ingested in turn; one failure doesn't stop the rest.

--check queries are optional. If given, after each video is ingested, each
query is embedded and scored against that video's just-inserted segments,
printed most-similar first — a quick sanity check that the embeddings are
semantically meaningful before trusting them in real search.
"""
import sys
from pathlib import Path

import numpy as np

from app.db import get_connection, init_schema
from app.ingestion import embed_clip, embed_text
from app.ingestion.pipeline import ingest_video_file

VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}


def run_checks(video_id: int, queries: list[str]) -> None:
    conn = get_connection()
    frame_rows = conn.execute(
        "SELECT start_time, frame_embedding FROM segments WHERE video_id=%s AND type='frame' ORDER BY start_time",
        (video_id,),
    ).fetchall()
    transcript_rows = conn.execute(
        "SELECT start_time, end_time, text, transcript_embedding FROM segments WHERE video_id=%s AND type='transcript' ORDER BY start_time",
        (video_id,),
    ).fetchall()
    conn.close()

    frame_rows = [(t, emb.to_numpy()) for t, emb in frame_rows]
    transcript_rows = [(s, e, text, emb.to_numpy()) for s, e, text, emb in transcript_rows]

    for query in queries:
        print(f"\n  === check: {query!r} ===")

        if frame_rows:
            qvec = embed_clip.embed_text(query)
            scored = sorted(frame_rows, key=lambda r: -float(np.dot(qvec, r[1])))
            print("    frames (top 3):")
            for t, emb in scored[:3]:
                print(f"      t={t:>6.1f}s  score={float(np.dot(qvec, emb)):.3f}")

        if transcript_rows:
            qvec = embed_text.embed_text(query)
            scored = sorted(transcript_rows, key=lambda r: -float(np.dot(qvec, r[3])))
            print("    transcripts (top 3):")
            for s, e, text, emb in scored[:3]:
                print(f"      t={s:>6.1f}-{e:.1f}s  score={float(np.dot(qvec, emb)):.3f}  {text!r}")


def ingest_one(path: Path, queries: list[str]) -> None:
    try:
        video_id = ingest_video_file(path)
    except Exception as e:
        print(f"  FAILED: {e}")
        return

    print(f"  Ingested video_id={video_id}")
    if queries:
        run_checks(video_id, queries)


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    target = Path(sys.argv[1]).resolve()
    if not target.exists():
        print(f"Not found: {target}")
        sys.exit(1)

    queries: list[str] = []
    if len(sys.argv) > 2:
        if sys.argv[2] != "--check":
            print(__doc__)
            sys.exit(1)
        queries = sys.argv[3:]

    init_schema()

    if target.is_dir():
        video_paths = sorted(
            p for p in target.iterdir()
            if p.is_file() and p.suffix.lower() in VIDEO_EXTENSIONS
        )
        if not video_paths:
            print(f"No video files found in {target}")
            sys.exit(1)

        print(f"Found {len(video_paths)} video(s) in {target}")
        for path in video_paths:
            print(f"\n--- {path.name} ---")
            ingest_one(path, queries)
    else:
        ingest_one(target, queries)


if __name__ == "__main__":
    main()
