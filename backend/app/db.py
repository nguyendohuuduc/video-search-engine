import psycopg
from pgvector.psycopg import register_vector
from psycopg_pool import ConnectionPool

from app.config import DATABASE_URL

SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    duration_sec REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS segments (
    id SERIAL PRIMARY KEY,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,
    text TEXT,
    frame_path TEXT,
    frame_embedding vector(512),
    transcript_embedding vector(384)
);

CREATE INDEX IF NOT EXISTS segments_frame_embedding_idx ON segments
    USING hnsw (frame_embedding vector_cosine_ops) WHERE frame_embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS segments_transcript_embedding_idx ON segments
    USING hnsw (transcript_embedding vector_cosine_ops) WHERE transcript_embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS segments_video_id_idx ON segments(video_id);
"""


def get_connection() -> psycopg.Connection:
    """A single ad hoc connection — used by the CLI and the background worker,
    where one-connection-per-call is simple and fine (no concurrent request load).
    """
    conn = psycopg.connect(DATABASE_URL, autocommit=True)
    register_vector(conn)
    return conn


def init_schema() -> None:
    with get_connection() as conn:
        conn.execute(SCHEMA)


def _configure_pooled_connection(conn: psycopg.Connection) -> None:
    register_vector(conn)
    conn.autocommit = True


# Used by the FastAPI app, where many request handlers may need a connection
# concurrently — opened/closed once in main.py's lifespan, not per-request.
pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=5, configure=_configure_pooled_connection, open=False)
