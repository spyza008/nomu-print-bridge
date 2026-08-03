param(
  [string]$NodePath = "node.exe"
)

$bridgePath = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverPath = Join-Path $bridgePath "src\server.js"
$action = New-ScheduledTaskAction -Execute $NodePath -Argument ('"{0}"' -f $serverPath) -WorkingDirectory $bridgePath
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
Register-ScheduledTask -TaskName "Nomu Print Bridge" -Action $action -Trigger $trigger -Principal $principal -Description "Starts the local Nomu ESC/POS printer bridge" -Force
Write-Host "Installed. The Print Bridge will start when $env:USERNAME signs in."
