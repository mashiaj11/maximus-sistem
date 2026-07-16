#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! docker compose ps n8n >/dev/null 2>&1; then
  echo "Suba o Docker antes: docker compose --env-file .env.docker up -d"
  exit 1
fi

for workflow in n8n/workflows/*.json; do
  [ -e "$workflow" ] || continue
  echo "Importando $workflow"
  docker compose --env-file .env.docker exec -T n8n n8n import:workflow --input="/tmp/$(basename "$workflow")" >/dev/null 2>&1 || true
  docker cp "$workflow" "$(docker compose --env-file .env.docker ps -q n8n):/tmp/$(basename "$workflow")"
  docker compose --env-file .env.docker exec -T n8n n8n import:workflow --input="/tmp/$(basename "$workflow")"
done

echo "Workflows importados. Ative-os no painel do n8n se necessario."
