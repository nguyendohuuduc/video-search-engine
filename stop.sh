#!/usr/bin/env bash
# Stops everything dev.sh starts: frontend, backend, and Postgres.
# Finds processes by port rather than by command name, so it works
# regardless of exactly how they were launched.

cd "$(dirname "$0")"

stop_port() {
  local port=$1
  local label=$2
  local pid
  pid=$(lsof -ti:"$port" 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "Stopping $label (port $port, pid $pid)..."
    kill $pid 2>/dev/null
  else
    echo "$label not running (nothing on port $port)."
  fi
}

stop_port 5173 "frontend"
stop_port 8000 "backend"

echo "Stopping Postgres..."
if pg_ctl -D backend/data/pgdata status > /dev/null 2>&1; then
  pg_ctl -D backend/data/pgdata stop
else
  echo "Postgres not running."
fi

echo "Done."
