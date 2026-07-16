#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f ".env.docker" ]; then
  docker compose --env-file .env.docker ps
else
  docker compose ps
fi

echo
for port in 8080 8081 5678 8082; do
  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Porta $port: em uso"
  else
    echo "Porta $port: livre"
  fi
done
