#!/bin/bash
# StockSystem Docker Setup Script

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 StockSystem Docker Setup${NC}"
echo "=============================="

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado${NC}"
    exit 1
fi

if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose no está instalado${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker encontrado${NC}"

# Verificar .env
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo -e "${YELLOW}⚠️  .env no encontrado, creando desde .env.example${NC}"
        cp .env.example .env
        echo -e "${RED}🛑 IMPORTANTE: Edita el archivo .env con tus credenciales antes de continuar${NC}"
        exit 1
    else
        echo -e "${RED}❌ No se encontró .env ni .env.example${NC}"
        exit 1
    fi
fi

# Validar variables críticas
echo -e "${YELLOW}🔍 Validando configuración...${NC}"

required_vars=(
    "VITE_SUPABASE_URL"
    "VITE_SUPABASE_ANON_KEY"
    "SUPABASE_URL"
    "SUPABASE_KEY"
)

missing=0
for var in "${required_vars[@]}"; do
    value=$(grep "^${var}=" .env | cut -d'=' -f2-)
    if [ -z "$value" ] || [ "$value" = "eyJ..." ] || [ "$value" = "https://xxxx.supabase.co" ]; then
        echo -e "${RED}❌ Variable requerida no configurada: ${var}${NC}"
        missing=1
    fi
done

if [ $missing -eq 1 ]; then
    echo -e "${RED}🛑 Configura las variables faltantes en .env y vuelve a ejecutar${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuración válida${NC}"

# Build
echo -e "${YELLOW}🏗️  Construyendo imágenes (puede tardar unos minutos)...${NC}"
docker compose build --no-cache

# Up
echo -e "${YELLOW}🚀 Iniciando servicios...${NC}"
docker compose up -d

# Esperar servicios
echo -e "${YELLOW}⏳ Esperando que los servicios inicien...${NC}"
sleep 10

# Estado
echo ""
echo -e "${GREEN}📊 Estado de servicios:${NC}"
docker compose ps

echo ""
echo -e "${GREEN}✅ Setup completo!${NC}"
echo ""
echo "URLs de acceso:"
echo "  Frontend: http://localhost:8080"
echo "  API:      http://localhost:3001"
echo "  Health:   http://localhost:3001/health"
echo ""
echo "Comandos útiles:"
echo "  Ver logs:        docker compose logs -f backend"
echo "  Ver QR WhatsApp: docker compose logs -f backend | grep QR"
echo "  Reiniciar todo:  docker compose restart"
echo "  Parar:           docker compose down"
echo ""
echo -e "${YELLOW}⚠️  La primera vez deberás escanear el QR de WhatsApp en los logs del backend${NC}"
