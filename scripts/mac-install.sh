#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

missing=0

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Faltando: $1"
    missing=1
  fi
}

need_cmd node
need_cmd npm
need_cmd docker

if [ "$missing" -ne 0 ]; then
  echo "Instale os itens acima no Mac e rode este script novamente."
  exit 1
fi

ARCH="$(uname -m)"
if [ "$ARCH" != "arm64" ]; then
  echo "Aviso: este pacote foi preparado para Apple Silicon arm64. Arquitetura atual: $ARCH"
fi

copy_env() {
  local example="$1"
  local target="$2"
  if [ ! -f "$target" ] && [ -f "$example" ]; then
    cp "$example" "$target"
    echo "Criado $target a partir de $example"
  fi
}

copy_env ".env.docker.example" ".env.docker"
copy_env "maximus-admin/.env.example" "maximus-admin/.env"
copy_env "maximus-public/.env.example" "maximus-public/.env"

check_port() {
  local port="$1"
  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Porta em uso: $port"
    return 1
  fi
}

check_port 8080 || true
check_port 8081 || true
check_port 5678 || true
check_port 8082 || true

echo "Instalando dependencias do Maximus Admin..."
npm --prefix maximus-admin install

echo "Instalando dependencias do Maximus Public..."
npm --prefix maximus-public install

mkdir -p n8n/workflows logs

echo
echo "Confira estes arquivos antes de iniciar:"
echo "- .env.docker"
echo "- maximus-admin/.env"
echo "- maximus-public/.env"
echo
echo "Variaveis obrigatorias:"
echo "- VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nos apps"
echo "- SUPABASE_URL, SUPABASE_SERVICE_ROLE, EVOLUTION_API_KEY e N8N_ENCRYPTION_KEY no .env.docker"
