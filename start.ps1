# ==================================================
# StockSystem - Start & Watch Logs (PowerShell)
# Usage: .\start.ps1 [-Build] [-NoBuild]
# ==================================================

param(
    [switch]$Build,
    [switch]$NoBuild
)

$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  StockSystem - Deploy & Logs" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build (unless -NoBuild)
if (-not $NoBuild) {
    Write-Host "[1/3] Building Docker images..." -ForegroundColor Yellow
    docker-compose -f "$ProjectDir\docker-compose.yml" build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "[1/3] Build complete!" -ForegroundColor Green
} else {
    Write-Host "[1/3] Skipping build (-NoBuild)" -ForegroundColor DarkGray
}

# Step 2: Start services
Write-Host "[2/3] Starting services..." -ForegroundColor Yellow
docker-compose -f "$ProjectDir\docker-compose.yml" up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start services!" -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] Services started!" -ForegroundColor Green
Write-Host ""

# Quick status
docker-compose -f "$ProjectDir\docker-compose.yml" ps

Write-Host ""
Write-Host "  Frontend: http://localhost:8080" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:3001/health" -ForegroundColor Cyan
Write-Host ""

# Step 3: Open backend logs in a new PowerShell window
Write-Host "[3/3] Opening backend logs in new window..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Backend Logs (stock-backend)' -ForegroundColor Cyan; Write-Host '================================' -ForegroundColor Cyan; docker logs -f stock-backend"

Write-Host ""
Write-Host "Done! Logs window opened." -ForegroundColor Green
Write-Host "To stop everything: docker-compose down" -ForegroundColor DarkGray
Write-Host ""
