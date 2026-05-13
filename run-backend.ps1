# Start the FastAPI backend from the correct folder (must run `app` package from `backend/`).
# Usage (from repo root):  .\run-backend.ps1
# From talent-tile-view:    ..\run-backend.ps1

$RepoRoot = $PSScriptRoot
$Backend = Join-Path $RepoRoot "backend"
$Python = Join-Path $RepoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    Write-Error "Virtual env not found at $Python — create it from repo root: py -3 -m venv .venv"
    exit 1
}
if (-not (Test-Path $Backend)) {
    Write-Error "Backend folder not found at $Backend"
    exit 1
}

Set-Location $Backend
& $Python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
