$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$LogDir = Join-Path $Root "logs"
$PidDir = Join-Path $LogDir "pids"
New-Item -ItemType Directory -Force -Path $LogDir, $PidDir | Out-Null

function Write-Log($Message) {
  $line = "$(Get-Date -Format s) $Message"
  Add-Content -Path (Join-Path $LogDir "inicio.log") -Value $line
  Write-Host $Message
}

function Test-Http($Url) {
  try { Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 | Out-Null; return $true } catch { return $false }
}

function Wait-Http($Name, $Url, $TimeoutSec = 120) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-Http $Url) { Write-Log "$Name disponivel em $Url"; return }
    Start-Sleep -Seconds 3
  }
  throw "$Name nao respondeu em $Url"
}

function Start-NpmApp($Name, $Dir, $Port) {
  $pidFile = Join-Path $PidDir "$Name.pid"
  if (Test-Path $pidFile) {
    $oldPid = [int](Get-Content $pidFile)
    if (Get-Process -Id $oldPid -ErrorAction SilentlyContinue) {
      Write-Log "$Name ja esta em execucao (PID $oldPid)."
      return
    }
  }

  $out = Join-Path $LogDir "$Name.out.log"
  $err = Join-Path $LogDir "$Name.err.log"
  $process = Start-Process -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory (Join-Path $Root $Dir) -RedirectStandardOutput $out -RedirectStandardError $err -PassThru -WindowStyle Hidden
  Set-Content -Path $pidFile -Value $process.Id
  Write-Log "$Name iniciado (PID $($process.Id))."
  Wait-Http $Name "http://127.0.0.1:$Port"
}

Set-Location $Root

if (-not (Test-Path ".env")) { throw ".env nao encontrado. Execute INSTALAR-MAXIMUS.ps1 primeiro." }

Write-Log "Iniciando containers Docker."
docker compose --env-file .env up -d

Wait-Http "n8n" "http://127.0.0.1:5678/healthz"
Wait-Http "Evolution API" "http://127.0.0.1:8082"

$exe = Get-ChildItem -Path (Join-Path $Root "maximus-admin") -Recurse -Filter "Maximus Admin.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($exe) {
  $process = Start-Process -FilePath $exe.FullName -PassThru
  Set-Content -Path (Join-Path $PidDir "admin-exe.pid") -Value $process.Id
  Write-Log "Admin Electron iniciado: $($exe.FullName)"
} else {
  Start-NpmApp "admin" "maximus-admin" 8080
}

Start-NpmApp "public" "maximus-public" 8081

Write-Host ""
Write-Host "Maximus iniciado:"
Write-Host "- Admin: http://127.0.0.1:8080 ou aplicativo Electron"
Write-Host "- Public: http://127.0.0.1:8081"
Write-Host "- n8n: http://127.0.0.1:5678"
Write-Host "- Evolution API: http://127.0.0.1:8082"
