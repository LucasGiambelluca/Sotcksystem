# StockSystem Docker Setup Script (Windows)
Write-Host "� StockSystem Docker Setup" -ForegroundColor Green
Write-Host "=============================="

# Verificar Docker
try {
    docker --version | Out-Null
} catch {
    Write-Host "❌ Docker no está instalado" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker encontrado" -ForegroundColor Green

# Verificar .env
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Host "⚠️  .env no encontrado, creando desde .env.example" -ForegroundColor Yellow
        Copy-Item ".env.example" ".env"
        Write-Host "🛑 IMPORTANTE: Edita el archivo .env con tus credenciales antes de continuar" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "❌ No se encontró .env ni .env.example" -ForegroundColor Red
        exit 1
    }
}

# Validar variables críticas
Write-Host "🔍 Validando configuración..." -ForegroundColor Yellow

$envContent = Get-Content ".env" -Raw
$requiredVars = @("VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "SUPABASE_URL", "SUPABASE_KEY")
$missing = $false

foreach ($var in $requiredVars) {
    $match = [regex]::Match($envContent, "(?m)^${var}=(.+)$")
    $value = if ($match.Success) { $match.Groups[1].Value.Trim() } else { "" }
    if ([string]::IsNullOrWhiteSpace($value) -or $value -eq "eyJ..." -or $value -eq "https://xxxx.supabase.co") {
        Write-Host "❌ Variable requerida no configurada: $var" -ForegroundColor Red
        $missing = $true
    }
}

if ($missing) {
    Write-Host "🛑 Configura las variables faltantes en .env y vuelve a ejecutar" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Configuración válida" -ForegroundColor Green

# Build
Write-Host "🏗️  Construyendo imágenes (puede tardar unos minutos)..." -ForegroundColor Yellow
docker compose build --no-cache

# Up
Write-Host "🚀 Iniciando servicios..." -ForegroundColor Yellow
docker compose up -d

# Esperar servicios
Write-Host "⏳ Esperando que los servicios inicien..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Estado
Write-Host ""
Write-Host "� Estado de servicios:" -ForegroundColor Green
docker compose ps

Write-Host ""
Write-Host "✅ Setup completo!" -ForegroundColor Green
Write-Host ""
Write-Host "URLs de acceso:"
Write-Host "  Frontend: http://localhost:8080"
Write-Host "  API:      http://localhost:3001"
Write-Host "  Health:   http://localhost:3001/health"
Write-Host ""
Write-Host "Comandos útiles:"
Write-Host "  Ver logs:        docker compose logs -f backend"
Write-Host "  Ver QR WhatsApp: docker compose logs -f backend | Select-String QR"
Write-Host "  Reiniciar todo:  docker compose restart"
Write-Host "  Parar:           docker compose down"
Write-Host ""
Write-Host "⚠️  La primera vez deberás escanear el QR de WhatsApp en los logs del backend" -ForegroundColor Yellow
