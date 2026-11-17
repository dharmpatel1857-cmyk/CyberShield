$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    if (-not (Test-Path -LiteralPath '.env')) {
        Copy-Item -LiteralPath '.env.example' -Destination '.env'
    }
    if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
        python -m venv .venv
    }
    & '.\.venv\Scripts\python.exe' -m pip install -r 'backend\requirements.txt'
    npm ci --prefix frontend
    & '.\scripts\start-all.ps1'
} finally {
    Pop-Location
}
