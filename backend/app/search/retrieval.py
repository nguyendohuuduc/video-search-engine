import numpy as np

from app.db import pool
from app.ingestion import embed_clip, embed_text

RRF_K = 60  # standard damping constant - keeps rank-1 vs rank-2 from being too extreme


def _search_frames(conn, qvec: np.ndarray, k: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT s.id, s.video_id, s.start_time, s.end_time, s.frame_path, v.original_name, v.filename
        FROM segments s JOIN videos v ON v.id = s.video_id
        WHERE s.frame_embedding IS NOT NULL
        ORDER BY s.frame_embedding <=> %(qvec)s
        LIMIT %(k)s
        """,
        {"qvec": qvec, "k": k},
    ).fetchall()
    return [
        {
            "segment_id": seg_id,
            "video_id": video_id,
            "video_title": title,
            "video_url": f"/media/videos/{filename}",
            "timestamp": start_time,
            "end_timestamp": end_time,
            "match_type": "frame",
            "snippet": None,
            "thumbnail_path": frame_path,
        }
        for seg_id, video_id, start_time, end_time, frame_path, title, filename in rows
    ]


def _search_transcripts_semantic(conn, qvec: np.ndarray, k: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT s.id, s.video_id, s.start_time, s.end_time, s.text, v.original_name, v.filename
        FROM segments s JOIN videos v ON v.id = s.video_id
        WHERE s.transcript_embedding IS NOT NULL
        ORDER BY s.transcript_embedding <=> %(qvec)s
        LIMIT %(k)s
        """,
        {"qvec": qvec, "k": k},
    ).fetchall()
    return [
        {
            "segment_id": seg_id,
            "video_id": video_id,
            "video_title": title,
            "video_url": f"/media/videos/{filename}",
            "timestamp": start_time,
            "end_timestamp": end_time,
            "match_type": "transcript",
            "snippet": text,
            "thumbnail_path": None,
        }
        for seg_id, video_id, start_time, end_time, text, title, filename in rows
    ]


def _search_transcripts_lexical(conn, query: str, k: int) -> list[dict]:
    """Exact/keyword matching over transcript text via Postgres full-text search
    (websearch_to_tsquery handles raw search-box input - plain terms, quoted
    phrases, minus-to-exclude - directly). Catches names/phrases/specific terms
    that the semantic embeddings above can miss or bury.
    """
    rows = conn.execute(
        """
        SELECT s.id, s.video_id, s.start_time, s.end_time, s.text, v.original_name, v.filename
        FROM segments s JOIN videos v ON v.id = s.video_id
        WHERE s.text_tsv @@ websearch_to_tsquery('english', %(query)s)
        ORDER BY ts_rank(s.text_tsv, websearch_to_tsquery('english', %(query)s)) DESC
        LIMIT %(k)s
        """,
        {"query": query, "k": k},
    ).fetchall()
    return [
        {
            "segment_id": seg_id,
            "video_id": video_id,
            "video_title": title,
            "video_url": f"/media/videos/{filename}",
            "timestamp": start_time,
            "end_timestamp": end_time,
            "match_type": "transcript",
            "snippet": text,
            "thumbnail_path": None,
        }
        for seg_id, video_id, start_time, end_time, text, title, filename in rows
    ]


def _reciprocal_rank_fusion(result_lists: list[list[dict]], k: int = RRF_K) -> list[dict]:
    """Merges independently-ranked result lists by rank position rather than by
    raw score, sidestepping the "are these scores even comparable" problem
    entirely (CLIP cosine, MiniLM cosine, and full-text ts_rank all live on
    unrelated scales). An item that places well in more than one list - e.g. a
    transcript chunk that scores high on both semantic and lexical search -
    gets its per-list scores summed, so being independently corroborated by
    multiple retrieval paths naturally outranks a single-source hit.
    """
    fused_scores: dict[int, float] = {}
    items: dict[int, dict] = {}

    for results in result_lists:
        for rank, item in enumerate(results, start=1):
            seg_id = item["segment_id"]
            fused_scores[seg_id] = fused_scores.get(seg_id, 0.0) + 1.0 / (k + rank)
            items.setdefault(seg_id, item)

    merged = [{**items[seg_id], "score": score} for seg_id, score in fused_scores.items()]
    merged.sort(key=lambda r: -r["score"])
    return merged


def _rescale_for_display(results: list[dict]) -> None:
    """Min-max normalizes the final, already-fused top-K list to a friendly
    0-1 range for the UI. Safe here (unlike normalizing each raw source
    before fusion) because RRF has already produced one single, genuinely
    comparable ranking - this is just cosmetic rescaling of that ranking,
    not a stand-in for cross-source comparability.
    """
    if not results:
        return
    scores = [r["score"] for r in results]
    lo, hi = min(scores), max(scores)
    span = hi - lo
    for r in results:
        r["score"] = 1.0 if span == 0 else (r["score"] - lo) / span


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
        transcript_semantic_results = _search_transcripts_semantic(conn, text_qvec, top_k)
        transcript_lexical_results = _search_transcripts_lexical(conn, query, top_k)

        merged = _reciprocal_rank_fusion(
            [frame_results, transcript_semantic_results, transcript_lexical_results]
        )[:top_k]

        _rescale_for_display(merged)

        for r in merged:
            r.pop("segment_id", None)
            if r["thumbnail_path"] is None:
                r["thumbnail_path"] = _resolve_thumbnail(conn, r["video_id"], r["timestamp"])
            thumbnail_path = r.pop("thumbnail_path")
            r["thumbnail_url"] = f"/media/{thumbnail_path}" if thumbnail_path else None

    return merged
