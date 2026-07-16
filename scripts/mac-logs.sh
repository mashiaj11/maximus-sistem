#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ "${1:-}" = "apps" ]; then
  tail -n 200 -f logs/maximus-admin.log logs/maximus-public.log
  exit 0
fi

if [ -f ".env.docker" ]; then
  docker compose --env-file .env.docker logs -f --tail=200
else
  docker compose logs -f --tail=200
fi
