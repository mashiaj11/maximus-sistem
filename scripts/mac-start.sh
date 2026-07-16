#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f ".env.docker" ]; then
  cp .env.docker.example .env.docker
  echo "Criado .env.docker. Preencha as credenciais e rode novamente."
  exit 1
fi

docker compose --env-file .env.docker up -d

mkdir -p logs

start_app() {
  local name="$1"
  local dir="$2"
  local port="$3"
  local pid_file="logs/${name}.pid"
  local log_file="logs/${name}.log"

  if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" >/dev/null 2>&1; then
    echo "$name ja esta rodando na porta $port"
    return
  fi

  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Porta $port ja esta em uso; nao iniciei $name."
    return
  fi

  (cd "$dir" && npm run dev > "../$log_file" 2>&1 & echo $! > "../$pid_file")
  echo "$name iniciado em http://127.0.0.1:$port"
}

start_app "maximus-admin" "maximus-admin" "8080"
start_app "maximus-public" "maximus-public" "8081"

echo "n8n: http://127.0.0.1:5678"
echo "Evolution API: http://127.0.0.1:8082"
