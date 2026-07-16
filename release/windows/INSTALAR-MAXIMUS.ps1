$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$LogDir = Join-Path $Root "logs"
$LogFile = Join-Path $LogDir "instalacao.log"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log($Message) {
  $line = "$(Get-Date -Format s) $Message"
  Add-Content -Path $LogFile -Value $line
  Write-Host $Message
}

function Invoke-Step($Name, [scriptblock]$Block) {
  Write-Log "==> $Name"
  try { & $Block; Write-Log "OK: $Name" } catch { Write-Log "ERRO em '$Name': $($_.Exception.Message)"; throw }
}

Set-Location $Root

Invoke-Step "Verificar sistema" { & (Join-Path $PSScriptRoot "VERIFICAR-SISTEMA.ps1") }

Invoke-Step "Preparar .env" {
  if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Log ".env criado a partir de .env.example. Preencha os valores antes de operar em producao."
  } else {
    Write-Log ".env existente preservado."
  }
}

Invoke-Step "Criar pastas locais" {
  foreach ($dir in @("logs", "release/windows")) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
}

Invoke-Step "Instalar dependencias Admin" { npm --prefix maximus-admin ci --legacy-peer-deps }
Invoke-Step "Instalar dependencias Public" { npm --prefix maximus-public ci --legacy-peer-deps }

Invoke-Step "Compilar Admin" { npm --prefix maximus-admin run build }
Invoke-Step "Compilar Public" { npm --prefix maximus-public run build }

Invoke-Step "Validar Docker Compose" { docker compose --env-file .env config | Out-Null }
Invoke-Step "Preparar imagens Docker" { docker compose --env-file .env pull }

Write-Log "Instalacao concluida. Edite .env se ainda houver placeholders e execute INICIAR-MAXIMUS.ps1."
