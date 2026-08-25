#!/usr/bin/env bash
# Starts Postgres, the backend, and the frontend dev server together.
# Ctrl+C stops the backend and frontend; Postgres is left running (it's a
# real database, not something you want killed by accident) - stop it
# separately with: pg_ctl -D backend/data/pgdata stop

set -e
cd "$(dirname "$0")"

# nvm only gets put on PATH via ~/.bashrc, which bash does NOT source for
# non-interactive scripts like this one (only interactive shells read it) -
# so `npm` would otherwise be unresolvable here even though it works fine
# in a normal terminal. Source nvm directly instead of relying on that.
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  \. "$NVM_DIR/nvm.sh"
  nvm use default > /dev/null
fi

if pg_ctl -D backend/data/pgdata status > /dev/null 2>&1; then
  echo "Postgres already running."
else
  echo "Starting Postgres..."
  pg_ctl -D backend/data/pgdata -l backend/data/pg.log -o "-p 5544" start
fi

echo "Starting backend..."
(cd backend && .venv/bin/python -m uvicorn app.main:app --reload) &
BACKEND_PID=$!

echo "Starting frontend..."
(cd frontend && npm run dev -- --host) &
FRONTEND_PID=$!

cleanup() {
  echo ""
  echo "Stopping backend and frontend (Postgres left running)..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

echo ""
echo "Backend:  http://127.0.0.1:8000/docs"
echo "Frontend: http://localhost:5173"
echo "(backend takes a few seconds to finish loading ML models)"
echo ""

wait
