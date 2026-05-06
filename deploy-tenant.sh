#!/bin/bash
set -e

# ==================================================
# SotckHub - Multi-Tenant Deployment Script
# ==================================================

# Colores para la consola
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Ayuda
usage() {
    echo "Uso: $0 --id [ID_CLIENTE] --domain [DOMINIO] --slug [SLUG_NEGOCIO]"
    echo ""
    echo "Ejemplo: $0 --id cliente1 --domain stocksystemspp.com --slug elpollocomilon"
    exit 1
}

# Parsear argumentos
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --id) TENANT_ID="$2"; shift ;;
        --domain) DOMAIN="$2"; shift ;;
        --slug) SLUG="$2"; shift ;;
        *) echo "Opción desconocida: $1"; usage ;;
    esac
    shift
done

# Validar argumentos
if [ -z "$TENANT_ID" ] || [ -z "$DOMAIN" ] || [ -z "$SLUG" ]; then
    usage
fi

echo -e "${CYAN}🚀 Desplegando Tenant: ${GREEN}$TENANT_ID${NC} en ${GREEN}$DOMAIN${NC}"

# 1. Preparar red si no existe
if ! docker network inspect stocksystem-proxy-net >/dev/null 2>&1; then
    echo -e "${YELLOW}Creando red stocksystem-proxy-net...${NC}"
    docker network create stocksystem-proxy-net
fi

# 2. Generar archivo de configuración de Caddy
CADDY_FILE="./proxy/sites-enabled/${TENANT_ID}.caddy"
echo -e "${YELLOW}Generando configuración de Caddy...${NC}"

cat > $CADDY_FILE <<EOF
$DOMAIN {
    # El nombre del host es [proyecto]-[servicio]
    # Cuando usamos -p $TENANT_ID, Docker nombra los contenedores así internamente
    reverse_proxy $TENANT_ID-app-1:3001 {
        transport http {
            dial_timeout 10s
            response_header_timeout 60s
        }
    }
}
EOF

# 3. Preparar variables de entorno para el Build
# Nota: Aquí podrías copiar un .env base si existe
echo -e "${YELLOW}Preparando entorno...${NC}"
export VITE_API_URL="https://$DOMAIN"
export VITE_APP_SLUG="$SLUG"
export CATALOG_SLUG="$SLUG"

# 4. Construir y Levantar
echo -e "${CYAN}🏗️ Construyendo y levantando instancia...${NC}"
docker compose -f docker-compose.prod.yml -p "$TENANT_ID" up -d --build

# 5. Recargar Proxy Maestro
echo -e "${YELLOW}Recargando Proxy Maestro...${NC}"
if docker ps | grep -q "stock-proxy-master"; then
    docker exec stock-proxy-master caddy reload --config /etc/caddy/Caddyfile
    echo -e "${GREEN}✅ Caddy recargado con éxito.${NC}"
else
    echo -e "${RED}⚠️ El Proxy Maestro no está corriendo. Levantalo con: cd proxy && docker compose -f docker-compose.proxy.yml up -d${NC}"
fi

echo -e "${GREEN}=================================================${NC}"
echo -e "🎉 Tenant ${CYAN}$TENANT_ID${NC} desplegado con éxito!"
echo -e "🔗 URL: ${CYAN}https://$DOMAIN/$SLUG/login${NC}"
echo -e "${GREEN}=================================================${NC}"
