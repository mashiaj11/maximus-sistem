$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Ports = @(8080, 8081, 5678, 8082)

function Write-Ok($Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn($Message) { Write-Host "[AVISO] $Message" -ForegroundColor Yellow }
function Write-Fail($Message) { Write-Host "[FALHA] $Message" -ForegroundColor Red }
function Test-Command($Name) { return [bool](Get-Command $Name -ErrorAction SilentlyContinue) }

function Test-Port($Port) {
  $busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($busy) { Write-Warn "Porta $Port ja esta em uso." } else { Write-Ok "Porta $Port livre." }
}

Write-Host "Verificando Maximus em: $Root"

$os = Get-CimInstance Win32_OperatingSystem
if ($os.Caption -match "Windows 10|Windows 11") { Write-Ok $os.Caption } else { Write-Warn "Sistema nao confirmado como Windows 10/11: $($os.Caption)" }

if ([Environment]::Is64BitOperatingSystem) { Write-Ok "Arquitetura x64." } else { Write-Fail "Windows nao e x64." }
Write-Ok "PowerShell $($PSVersionTable.PSVersion)"

foreach ($cmd in @("git", "node", "npm", "docker")) {
  if (Test-Command $cmd) {
    $version = (& $cmd --version 2>$null | Select-Object -First 1)
    Write-Ok "$cmd encontrado: $version"
  } else {
    Write-Fail "$cmd nao encontrado no PATH."
  }
}

if (Test-Command docker) {
  try {
    docker compose version | Out-Null
    Write-Ok "Docker Compose disponivel."
  } catch {
    Write-Fail "Docker Compose nao respondeu. Abra o Docker Desktop e tente novamente."
  }
}

foreach ($port in $Ports) { Test-Port $port }

$drive = Get-PSDrive -Name (Split-Path $Root -Qualifier).TrimEnd(":")
$freeGb = [math]::Round($drive.Free / 1GB, 2)
if ($freeGb -ge 10) { Write-Ok "Espaco livre: $freeGb GB." } else { Write-Warn "Pouco espaco livre: $freeGb GB. Recomendado: 10 GB ou mais." }

foreach ($file in @(".env.example", "docker-compose.yml", "maximus-admin/package.json", "maximus-public/package.json")) {
  if (Test-Path (Join-Path $Root $file)) { Write-Ok "Arquivo obrigatorio: $file" } else { Write-Fail "Arquivo obrigatorio ausente: $file" }
}

if (Test-Path (Join-Path $Root ".env")) { Write-Ok ".env encontrado." } else { Write-Warn ".env ainda nao existe. O instalador pode criar a partir de .env.example." }

Write-Host "Verificacao concluida."
