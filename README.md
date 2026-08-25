# video-search-engine

A personal video search engine: upload your own videos and get semantic search over
them — "find the part where I explained the pricing model" (speech) or "show me
clips with a dog in them" (visual) — instead of scrubbing timelines.

Hybrid retrieval over two signals:
- **Visual**: frames sampled every 1s, embedded with CLIP (`open_clip`, `ViT-B-32-quickgelu`)
- **Speech**: transcribed with `faster-whisper`, chunked into ~20s windows, embedded with
  a sentence-transformer (`all-MiniLM-L6-v2`)

Both land in Postgres with [pgvector](https://github.com/pgvector/pgvector), searched via
HNSW indexes and merged into one ranked list of matching moments.

Everything runs **locally** — no cloud APIs, no GPU required (CPU inference is fast enough
at personal-library scale).

## Status

- [x] **Phase 1** — ingestion pipeline (frame extraction, transcription, both embeddings,
      Postgres storage), validated against real video
- [x] **Phase 2** — FastAPI backend (upload/search endpoints, background job worker),
      validated end-to-end against real requests
- [ ] **Phase 3** — React frontend
- [x] **Phase 4** — video player with marker-strip timeline, click-to-seek from
      results and markers, validated end-to-end in a browser
- [x] **Phase 5** — upload UI with status polling, video library view, validated
      end-to-end in a browser
- [ ] **Phase 6** — polish

## Setup

### 1. Postgres + pgvector (runs locally via conda, no sudo/Docker needed)

```bash
conda install -c conda-forge postgresql pgvector
initdb -D backend/data/pgdata -U $(whoami)
pg_ctl -D backend/data/pgdata -l backend/data/pg.log -o "-p 5544" start
createdb -p 5544 videosearch
psql -p 5544 videosearch -c "CREATE EXTENSION vector;"
```

`pg_ctl -D backend/data/pgdata stop` shuts it down. Runs as an ordinary user process on
port 5544 (chosen to avoid clashing with any system Postgres).

### 2. Python backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install -r requirements.txt
```

`ffmpeg` doesn't need to be installed system-wide — frame extraction uses the static
binary bundled by `imageio-ffmpeg`.

### 3. Frontend (not built yet — needs Node.js)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20 && nvm use 20
```

## Running the server

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --reload
```

Swagger UI at `http://127.0.0.1:8000/docs` — upload a video, poll its status, run searches,
all without a frontend. Endpoints: `POST /api/videos` (upload), `GET /api/videos`,
`GET /api/videos/{id}` (status), `POST /api/search`.

## Usage (CLI, useful for one-off ingestion/testing without the server)

Ingest a single video, or every video in a folder:

```bash
cd backend
.venv/bin/python -m app.cli.ingest_video path/to/video.mp4
.venv/bin/python -m app.cli.ingest_video path/to/folder/
```

Add `--check "query1" "query2" ...` to sanity-check the resulting embeddings — for each
query, prints the top-3 matching frames and transcript chunks by cosine similarity:

```bash
.venv/bin/python -m app.cli.ingest_video path/to/video.mp4 --check "a dog" "pricing model"
```

## Project structure

```
backend/
  app/
    config.py            # paths, model names, tunables
    db.py                 # Postgres connection + schema (pgvector, HNSW indexes)
    ingestion/
      frames.py           # ffmpeg frame sampling
      transcribe.py        # faster-whisper + chunking into windows
      embed_clip.py         # CLIP image/text embeddings
      embed_text.py          # sentence-transformer text embeddings
      pipeline.py             # orchestrates ingestion end-to-end
    cli/
      ingest_video.py          # standalone pipeline test/entrypoint
  requirements.txt
frontend/                       # not built yet
```
