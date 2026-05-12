#!/bin/bash
set -e

# ==================================================
# StockSystem - Smart Deployer v2.1
# Automatiza el despliegue y la coexistencia con el Proxy
# ==================================================

# Colores para la terminal
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}🚀 Iniciando Smart Deploy...${NC}"

# 1. Verificar entorno
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: No se encuentra el archivo .env en la raíz.${NC}"
    exit 1
fi

# 2. Actualizar código (Opcional, descomentar si se usa Git en el server)
# echo -e "${YELLOW}📥 Actualizando código desde Git...${NC}"
# git pull origin main

# 3. Construir e Inyectar variables en Frontend
echo -e "${YELLOW}🏗️  Paso 1: Construyendo imagen unificada (Docker)...${NC}"
docker compose -f docker-compose.prod.yml build

# 4. Reiniciar Aplicación
echo -e "${YELLOW}🔄 Paso 2: Reiniciando contenedores de la App...${NC}"
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# 5. Asegurar que el Proxy Maestro esté corriendo
echo -e "${YELLOW}📡 Paso 3: Verificando Proxy Maestro...${NC}"
if [ -d "proxy" ]; then
    cd proxy
    # Si el proxy no está corriendo, lo iniciamos
    if [ ! "$(docker ps -q -f name=stock-proxy-master)" ]; then
        echo -e "${CYAN}🔨 Iniciando Proxy Maestro por primera vez...${NC}"
        docker compose -f docker-compose.proxy.yml up -d
    else
        echo -e "${GREEN}✅ Proxy Maestro ya está corriendo. Recargando configuración...${NC}"
        docker exec stock-proxy-master caddy reload --config /etc/caddy/Caddyfile
    fi
    cd ..
else
    echo -e "${RED}⚠️  Advertencia: No se encontró la carpeta 'proxy'. El ruteo externo podría fallar.${NC}"
fi

echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}✅ ¡DESPLIEGUE COMPLETADO EXITOSAMENTE!${NC}"
echo -e "${CYAN}La aplicación debería estar disponible en tu dominio.${NC}"
echo -e "${GREEN}==================================================${NC}"
