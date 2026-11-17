$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot '.env'
$apiPort = 8001
if (Test-Path -LiteralPath $envFile) {
    $portLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^API_PORT=\d+$' } | Select-Object -First 1
    if ($portLine) { $apiPort = [int](($portLine -split '=', 2)[1]) }
}
$runtimeDir = Join-Path $repoRoot '.runtime'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$pythonExe = Join-Path $repoRoot '.venv\Scripts\python.exe'
$viteScript = Join-Path $repoRoot 'frontend\node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Python dependencies are missing. Run scripts\start.ps1 first.' }
if (-not (Test-Path -LiteralPath $viteScript)) { throw 'Frontend dependencies are missing. Run scripts\start.ps1 first.' }

$apiListener = Get-NetTCPConnection -State Listen -LocalPort $apiPort -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $apiListener) {
    $apiArguments = @('-m', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', "$apiPort")
    $apiProcess = Start-Process -FilePath $pythonExe -ArgumentList $apiArguments -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'api.log') -RedirectStandardError (Join-Path $runtimeDir 'api-error.log') -PassThru
    Write-Output "Started CyberShield API (PID $($apiProcess.Id)) on http://127.0.0.1:$apiPort"
} else {
    Write-Output "API port $apiPort is already listening; leaving the existing process alone."
}

$webListener = Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $webListener) {
    $nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
    $webArguments = @("`"$viteScript`"", '--host', '127.0.0.1', '--port', '5173', '--strictPort')
    $webProcess = Start-Process -FilePath $nodeExe -ArgumentList $webArguments -WorkingDirectory (Join-Path $repoRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'frontend.log') -RedirectStandardError (Join-Path $runtimeDir 'frontend-error.log') -PassThru
    Write-Output "Started CyberShield dashboard (PID $($webProcess.Id)) on http://127.0.0.1:5173"
} else {
    Write-Output 'Dashboard port 5173 is already listening; leaving the existing process alone.'
}

Start-Sleep -Seconds 2
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$apiPort/api/v1/health" -TimeoutSec 3
    Write-Output "API health: $($health.status) ($($health.service))"
} catch {
    Write-Warning "API has not answered yet. Check $runtimeDir\api-error.log."
}
Write-Output 'Dashboard: http://127.0.0.1:5173'
