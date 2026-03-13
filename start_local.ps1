# ==================================================
# StockSystem - Start Local Development (PowerShell)
# Usa las variables del archivo .env local
# ==================================================

$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  StockSystem - Inicio Local" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 1. Cargar variables del .env en la sesión
$EnvFile = "$ProjectDir\.env"
if (Test-Path $EnvFile) {
    Write-Host "[1/3] Cargando credenciales del .env local..." -ForegroundColor Yellow
    foreach ($line in Get-Content $EnvFile) {
        # Ignorar líneas vacías o comentarios
        if ($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)) { continue }
        
        # Parsear variables VAR=value
        if ($line -match '^(?<name>[^=]+)=(?<value>.*)$') {
            $name = $matches['name'].Trim()
            $value = $matches['value'].Trim()
            # Eliminar comillas si las tiene
            $value = $value -replace '^"|"$', ''
            $value = $value -replace "^'|'$", ''
            
            # Establecer variable de entorno en esta sesión
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "[1/3] Credenciales cargadas!" -ForegroundColor Green
} else {
    Write-Host "[Error] No se encontró el archivo .env en $EnvFile" -ForegroundColor Red
    exit 1
}

# 2. Iniciar el Backend en una nueva ventana
Write-Host "[2/3] Iniciando el servidor Backend (Node.js/Baileys)..." -ForegroundColor Yellow
$BackendCmd = "cd '$ProjectDir\whatsapp-server'; Write-Host 'Backend Logs' -ForegroundColor Cyan; Write-Host '==========================' -ForegroundColor Cyan; pnpm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $BackendCmd

# 3. Iniciar el Frontend (Panel/Catálogo) en esta ventana
Write-Host "[3/3] Iniciando el Frontend (Vite)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  👉 Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "  👉 Backend:  http://localhost:3001" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona Ctrl+C para detener." -ForegroundColor DarkGray
Write-Host ""

Set-Location "$ProjectDir\client"
pnpm run dev
