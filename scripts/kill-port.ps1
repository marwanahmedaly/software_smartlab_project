#!/usr/bin/env pwsh
# kill-port.ps1 — Kill any process listening on a given port
# Usage: .\kill-port.ps1 3001
# Or:    powershell -ExecutionPolicy Bypass -File .\kill-port.ps1 3001

param(
    [Parameter(Mandatory)]
    [int]$Port
)

$procs = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if (-not $procs) {
    Write-Host "No process found listening on port $Port"
    exit 0
}

foreach ($pid in $procs) {
    try {
        $proc = Get-Process -Id $pid -ErrorAction Stop
        Write-Host "Killing PID $pid ($($proc.ProcessName)) on port $Port ..."
        Stop-Process -Id $pid -Force
        Write-Host "Done."
    } catch {
        Write-Host "Failed to kill PID $pid : $_"
    }
}
