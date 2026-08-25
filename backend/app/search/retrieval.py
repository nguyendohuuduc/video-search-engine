import numpy as np

from app.db import pool
from app.ingestion import embed_clip, embed_text


def _normalize_scores(results: list[dict]) -> None:
    """Per-source min-max normalization to [0, 1], in place. CLIP and MiniLM
    cosine scores are not on comparable scales, so each result list is rescaled
    relative only to itself before the two get merged and sorted together.
    """
    if not results:
        return
    scores = [r["score"] for r in results]
    lo, hi = min(scores), max(scores)
    span = hi - lo
    for r in results:
        r["score"] = 1.0 if span == 0 else (r["score"] - lo) / span


def _search_frames(conn, qvec: np.ndarray, k: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT s.video_id, s.start_time, s.frame_path, v.original_name,
               1 - (s.frame_embedding <=> %(qvec)s) AS score
        FROM segments s JOIN videos v ON v.id = s.video_id
        WHERE s.frame_embedding IS NOT NULL
        ORDER BY s.frame_embedding <=> %(qvec)s
        LIMIT %(k)s
        """,
        {"qvec": qvec, "k": k},
    ).fetchall()
    return [
        {
            "video_id": video_id,
            "video_title": title,
            "timestamp": start_time,
            "match_type": "frame",
            "score": float(score),
            "snippet": None,
            "thumbnail_path": frame_path,
        }
        for video_id, start_time, frame_path, title, score in rows
    ]


def _search_transcripts(conn, qvec: np.ndarray, k: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT s.video_id, s.start_time, s.text, v.original_name,
               1 - (s.transcript_embedding <=> %(qvec)s) AS score
        FROM segments s JOIN videos v ON v.id = s.video_id
        WHERE s.transcript_embedding IS NOT NULL
        ORDER BY s.transcript_embedding <=> %(qvec)s
        LIMIT %(k)s
        """,
        {"qvec": qvec, "k": k},
    ).fetchall()
    return [
        {
            "video_id": video_id,
            "video_title": title,
            "timestamp": start_time,
            "match_type": "transcript",
            "score": float(score),
            "snippet": text,
            "thumbnail_path": None,
        }
        for video_id, start_time, text, title, score in rows
    ]


def _resolve_thumbnail(conn, video_id: int, timestamp: float) -> str | None:
    row = conn.execute(
        """
        SELECT frame_path FROM segments
        WHERE video_id = %s AND type = 'frame'
        ORDER BY ABS(start_time - %s) ASC
        LIMIT 1
        """,
        (video_id, timestamp),
    ).fetchone()
    return row[0] if row else None


def search(query: str, top_k: int = 20) -> list[dict]:
    clip_qvec = embed_clip.embed_text(query)
    text_qvec = embed_text.embed_text(query)

    with pool.connection() as conn:
        frame_results = _search_frames(conn, clip_qvec, top_k)
        transcript_results = _search_transcripts(conn, text_qvec, top_k)

        _normalize_scores(frame_results)
        _normalize_scores(transcript_results)

        merged = sorted(frame_results + transcript_results, key=lambda r: -r["score"])[:top_k]

        for r in merged:
            if r["thumbnail_path"] is None:
                r["thumbnail_path"] = _resolve_thumbnail(conn, r["video_id"], r["timestamp"])
            thumbnail_path = r.pop("thumbnail_path")
            r["thumbnail_url"] = f"/media/{thumbnail_path}" if thumbnail_path else None

    return merged
