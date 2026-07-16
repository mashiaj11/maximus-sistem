$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$LogDir = Join-Path $Root "logs"
$PidDir = Join-Path $LogDir "pids"

function Stop-PidFile($Name) {
  $pidFile = Join-Path $PidDir "$Name.pid"
  if (-not (Test-Path $pidFile)) { return }
  $pid = [int](Get-Content $pidFile)
  $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $pid -Force
    Write-Host "$Name encerrado (PID $pid)."
  }
  Remove-Item $pidFile -Force
}

Set-Location $Root

foreach ($name in @("admin", "public", "admin-exe")) { Stop-PidFile $name }

docker compose --env-file .env stop
Write-Host "Servicos Docker parados sem apagar volumes."
