$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Desktop = [Environment]::GetFolderPath("Desktop")
$Shell = New-Object -ComObject WScript.Shell

function New-Shortcut($Name, $Target, $Arguments = "", $WorkingDirectory = $Root) {
  $shortcut = $Shell.CreateShortcut((Join-Path $Desktop "$Name.lnk"))
  $shortcut.TargetPath = $Target
  $shortcut.Arguments = $Arguments
  $shortcut.WorkingDirectory = $WorkingDirectory
  $shortcut.Save()
  Write-Host "Atalho criado: $Name"
}

$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
New-Shortcut "Iniciar Maximus" $powershell "-ExecutionPolicy Bypass -File `"$Root\setup-windows\INICIAR-MAXIMUS.ps1`""
New-Shortcut "Parar Maximus" $powershell "-ExecutionPolicy Bypass -File `"$Root\setup-windows\PARAR-MAXIMUS.ps1`""
New-Shortcut "Abrir painel n8n" "http://127.0.0.1:5678"
New-Shortcut "Abrir logs Maximus" (Join-Path $Root "logs")

$exe = Get-ChildItem -Path (Join-Path $Root "maximus-admin") -Recurse -Filter "Maximus Admin.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($exe) {
  New-Shortcut "Abrir Maximus Admin" $exe.FullName
} else {
  New-Shortcut "Abrir Maximus Admin Dev" "http://127.0.0.1:8080"
}
