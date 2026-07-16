#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

for name in maximus-admin maximus-public; do
  pid_file="logs/${name}.pid"
  if [ -f "$pid_file" ]; then
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" || true
      echo "$name parado."
    fi
    rm -f "$pid_file"
  fi
done

if [ -f ".env.docker" ]; then
  docker compose --env-file .env.docker down
else
  docker compose down
fi
