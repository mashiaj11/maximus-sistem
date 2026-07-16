$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Report = Join-Path $Root "logs\atualizacao.log"
New-Item -ItemType Directory -Force -Path (Split-Path $Report) | Out-Null

function Write-Log($Message) {
  $line = "$(Get-Date -Format s) $Message"
  Add-Content -Path $Report -Value $line
  Write-Host $Message
}

Set-Location $Root

$status = git status --porcelain
if ($status) {
  Write-Log "Ha alteracoes locais. Atualizacao automatica interrompida para nao sobrescrever trabalho local."
  Write-Log $status
  throw "Resolva ou commite as alteracoes locais antes de atualizar."
}

Write-Log "Buscando atualizacoes."
git fetch --prune
$before = git rev-parse HEAD
git pull --ff-only
$after = git rev-parse HEAD

if ($before -eq $after) {
  Write-Log "Repositorio ja estava atualizado."
} else {
  Write-Log "Atualizado de $before para $after."
}

npm --prefix maximus-admin ci --legacy-peer-deps
npm --prefix maximus-public ci --legacy-peer-deps
npm run build
docker compose --env-file .env pull
docker compose --env-file .env up -d

Write-Log "Atualizacao concluida. .env, volumes e dados foram preservados."
