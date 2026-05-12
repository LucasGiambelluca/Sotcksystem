#!/bin/bash
set -e

# ==============================================================================
# StockSystem - Multi-Tenant Safe Deploy
# ==============================================================================
# Despliega tenants desde sus carpetas independientes en /opt/
# SIN afectar los contenedores que ya corren.
#
# Estructura esperada en el VPS:
#   /opt/stocksystem/                       → El Pollo Comilón
#   /opt/eldelirio/stocksystem-eldelirio/   → El Delirio
#
# Uso:
#   ./deploy-multitenant.sh eldelirio       → Despliega solo El Delirio
#   ./deploy-multitenant.sh elpollocomilon  → Redespliega El Pollo Comilón
#   ./deploy-multitenant.sh all             → Despliega todos
#   ./deploy-multitenant.sh status          → Muestra estado
# ==============================================================================

# --- Colores ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# --- Configuración de Tenants ---
# Cada tenant define:
#   DIRECTORIO | CONTAINER_NAME | DOMINIO | SLUG
# El .env se lee del directorio de cada tenant

declare -A TENANT_DIR
declare -A TENANT_CONTAINER
declare -A TENANT_DOMAIN
declare -A TENANT_SLUG

# --- El Pollo Comilón ---
TENANT_DIR[elpollocomilon]="/opt/stocksystem"
TENANT_CONTAINER[elpollocomilon]="stock-app"
TENANT_DOMAIN[elpollocomilon]="stocksystemspp.com"
TENANT_SLUG[elpollocomilon]="elpollocomilon"

# --- El Delirio ---
TENANT_DIR[eldelirio]="/opt/eldelirio/stocksystem-eldelirio"
TENANT_CONTAINER[eldelirio]="stock-app-eldelirio"
TENANT_DOMAIN[eldelirio]="eldelirio.stocksystemspp.com"
TENANT_SLUG[eldelirio]="eldelirio"

# --- Infraestructura compartida ---
CADDY_CONTAINER="stock-caddy"
REDIS_CONTAINER="stock-redis-service"

# ==============================================================================
# Funciones
# ==============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  ${BOLD}StockSystem Multi-Tenant Deploy${NC}${CYAN}                 ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
}

get_network() {
    # Detectar la red Docker que usa Caddy (la misma que el sistema actual)
    local net
    net=$(docker inspect "${CADDY_CONTAINER}" --format '{{range $key, $val := .NetworkSettings.Networks}}{{$key}}{{end}}' 2>/dev/null || echo "")
    if [ -z "$net" ]; then
        net=$(docker inspect stock-app --format '{{range $key, $val := .NetworkSettings.Networks}}{{$key}}{{end}}' 2>/dev/null || echo "")
    fi
    if [ -z "$net" ]; then
        echo "stocksystem_stock-network"
    else
        echo "$net"
    fi
}

show_status() {
    echo -e "${BOLD}📊 Estado de contenedores:${NC}"
    echo ""
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" --filter "name=stock-"
    echo ""
    echo -e "${BOLD}💾 Recursos:${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" --filter "name=stock-"
    echo ""
    echo -e "${BOLD}🌐 Ruteo Caddy activo:${NC}"
    docker exec "${CADDY_CONTAINER}" cat /etc/caddy/Caddyfile 2>/dev/null | grep -E "^[a-z].*\{" || echo "  (no se pudo leer)"
    echo ""
}

deploy_tenant() {
    local TENANT_ID="$1"

    # Validar que el tenant existe en la configuración
    if [ -z "${TENANT_DIR[$TENANT_ID]}" ]; then
        echo -e "${RED}❌ Tenant '${TENANT_ID}' no está registrado.${NC}"
        echo -e "   Tenants disponibles: ${!TENANT_DIR[*]}"
        exit 1
    fi

    local DIR="${TENANT_DIR[$TENANT_ID]}"
    local CONTAINER="${TENANT_CONTAINER[$TENANT_ID]}"
    local DOMAIN="${TENANT_DOMAIN[$TENANT_ID]}"
    local SLUG="${TENANT_SLUG[$TENANT_ID]}"
    local ENV_FILE="${DIR}/.env"
    local IMAGE_NAME="stocksystem-${TENANT_ID}"

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}🏪 Desplegando: ${GREEN}${TENANT_ID}${NC}"
    echo -e "   Directorio:  ${DIR}"
    echo -e "   Contenedor:  ${CONTAINER}"
    echo -e "   Dominio:     ${DOMAIN}"
    echo -e "   Slug:        ${SLUG}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # 1. Verificar que el directorio existe
    if [ ! -d "$DIR" ]; then
        echo -e "${RED}❌ No existe el directorio: ${DIR}${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Directorio encontrado"

    # 2. Verificar .env
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}❌ No se encontró: ${ENV_FILE}${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Archivo .env encontrado"

    # 3. Verificar Dockerfile
    if [ ! -f "${DIR}/Dockerfile.unified" ]; then
        echo -e "${RED}❌ No se encontró: ${DIR}/Dockerfile.unified${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Dockerfile.unified encontrado"

    # 4. Extraer variables de build del .env
    local VITE_SUPABASE_URL
    local VITE_SUPABASE_ANON_KEY
    VITE_SUPABASE_URL=$(grep -E "^VITE_SUPABASE_URL=" "$ENV_FILE" | head -1 | cut -d= -f2-)
    VITE_SUPABASE_ANON_KEY=$(grep -E "^VITE_SUPABASE_ANON_KEY=" "$ENV_FILE" | head -1 | cut -d= -f2-)

    # 5. Detectar red Docker
    local NETWORK
    NETWORK=$(get_network)
    echo -e "${GREEN}✓${NC} Red Docker: ${NETWORK}"

    # 6. Construir imagen
    echo ""
    echo -e "${YELLOW}[1/4] 🏗️  Construyendo imagen desde ${DIR}...${NC}"

    docker build -t "${IMAGE_NAME}" \
        -f "${DIR}/Dockerfile.unified" \
        --build-arg VITE_APP_SLUG="${SLUG}" \
        --build-arg VITE_API_URL="/api" \
        --build-arg VITE_SUPABASE_URL="${VITE_SUPABASE_URL}" \
        --build-arg VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY}" \
        "${DIR}"

    echo -e "${GREEN}✓${NC} Imagen construida: ${IMAGE_NAME}"

    # 7. Detener contenedor anterior (si existe) — SOLO del tenant que se despliega
    echo ""
    echo -e "${YELLOW}[2/4] 🔄 Reemplazando contenedor...${NC}"
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
        echo "   Deteniendo: ${CONTAINER}..."
        docker stop "${CONTAINER}" 2>/dev/null || true
        docker rm "${CONTAINER}" 2>/dev/null || true
        echo -e "${GREEN}✓${NC} Contenedor anterior removido"
    else
        echo -e "${GREEN}✓${NC} No hay contenedor anterior (primera vez)"
    fi

    # 8. Levantar contenedor nuevo
    echo ""
    echo -e "${YELLOW}[3/4] 🚀 Levantando ${CONTAINER}...${NC}"

    docker run -d \
        --name "${CONTAINER}" \
        --network "${NETWORK}" \
        --env-file "${ENV_FILE}" \
        -e REDIS_URL="redis://${REDIS_CONTAINER}:6379" \
        -e PORT=3001 \
        -e NODE_ENV=production \
        -v "${TENANT_ID}_sessions:/app/sessions" \
        -v "${TENANT_ID}_logs:/app/logs" \
        --restart unless-stopped \
        "${IMAGE_NAME}"

    # 9. Esperar arranque
    echo "   Esperando arranque (15s)..."
    sleep 15

    if docker ps --filter "name=^${CONTAINER}$" --filter "status=running" -q | grep -q .; then
        echo -e "${GREEN}✓${NC} ${CONTAINER} está corriendo"

        # Mostrar últimas líneas para verificar
        echo ""
        echo -e "${CYAN}   Últimas líneas del log:${NC}"
        docker logs "${CONTAINER}" --tail 5 2>&1 | sed 's/^/   /'
    else
        echo -e "${RED}✗ ${CONTAINER} falló al iniciar. Log:${NC}"
        docker logs "${CONTAINER}" --tail 30
        exit 1
    fi

    echo ""
    echo -e "${YELLOW}[4/4] ✅ Tenant ${TENANT_ID} listo${NC}"
}

update_caddy() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}🔒 Actualizando Caddy...${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Generar Caddyfile basado en los contenedores que están corriendo
    local CADDYFILE=""
    CADDYFILE+="# ============================================================\n"
    CADDYFILE+="# CADDYFILE - Multi-Tenant (auto-generado)\n"
    CADDYFILE+="# Generado: $(date '+%Y-%m-%d %H:%M:%S')\n"
    CADDYFILE+="# NO EDITAR MANUALMENTE - Se regenera con deploy-multitenant.sh\n"
    CADDYFILE+="# ============================================================\n"

    local ACTIVE_COUNT=0

    for TID in "${!TENANT_DIR[@]}"; do
        local CONTAINER="${TENANT_CONTAINER[$TID]}"
        local DOMAIN="${TENANT_DOMAIN[$TID]}"

        if docker ps --filter "name=^${CONTAINER}$" --filter "status=running" -q | grep -q .; then
            CADDYFILE+="\n# --- ${TID} ---\n"
            CADDYFILE+="${DOMAIN} {\n"
            CADDYFILE+="    reverse_proxy ${CONTAINER}:3001 {\n"
            CADDYFILE+="        transport http {\n"
            CADDYFILE+="            dial_timeout 10s\n"
            CADDYFILE+="            response_header_timeout 60s\n"
            CADDYFILE+="        }\n"
            CADDYFILE+="    }\n"
            CADDYFILE+="    log {\n"
            CADDYFILE+="        output file /data/${TID}.log {\n"
            CADDYFILE+="            roll_size 10mb\n"
            CADDYFILE+="            roll_keep 3\n"
            CADDYFILE+="        }\n"
            CADDYFILE+="    }\n"
            CADDYFILE+="}\n"

            echo -e "  ${GREEN}✓${NC} ${DOMAIN} → ${CONTAINER}:3001"
            ACTIVE_COUNT=$((ACTIVE_COUNT + 1))
        else
            echo -e "  ${YELLOW}⚠${NC} ${TID}: contenedor ${CONTAINER} no corre, se omite"
        fi
    done

    if [ "$ACTIVE_COUNT" -eq 0 ]; then
        echo -e "${RED}❌ No hay tenants activos. Abortando actualización de Caddy.${NC}"
        return 1
    fi

    # Escribir y aplicar
    echo -e "$CADDYFILE" > /tmp/Caddyfile.multitenant

    echo ""
    echo "  Caddyfile generado:"
    echo -e "${CYAN}"
    cat /tmp/Caddyfile.multitenant
    echo -e "${NC}"

    # Copiar al contenedor
    docker cp /tmp/Caddyfile.multitenant "${CADDY_CONTAINER}:/etc/caddy/Caddyfile"

    # Validar antes de recargar
    echo "  Validando configuración..."
    if docker exec "${CADDY_CONTAINER}" caddy validate --config /etc/caddy/Caddyfile 2>&1; then
        echo -e "  ${GREEN}✓${NC} Configuración válida"
    else
        echo -e "  ${RED}✗ Configuración inválida. NO se recargó Caddy.${NC}"
        echo -e "  ${YELLOW}El tráfico sigue funcionando con la config anterior.${NC}"
        rm -f /tmp/Caddyfile.multitenant
        return 1
    fi

    # Reload (zero downtime)
    if docker exec "${CADDY_CONTAINER}" caddy reload --config /etc/caddy/Caddyfile 2>&1; then
        echo -e "  ${GREEN}✓${NC} Caddy recargado (zero downtime)"
    else
        echo -e "  ${RED}✗ Error al recargar. El tráfico sigue con la config anterior.${NC}"
        rm -f /tmp/Caddyfile.multitenant
        return 1
    fi

    rm -f /tmp/Caddyfile.multitenant
}

# ==============================================================================
# Main
# ==============================================================================

print_header

ACTION="${1:-status}"

case "$ACTION" in
    status)
        show_status
        ;;

    all)
        echo -e "${BOLD}Desplegando TODOS los tenants...${NC}"
        echo ""

        # Verificar infraestructura
        if ! docker ps --filter "name=${REDIS_CONTAINER}" --filter "status=running" -q | grep -q .; then
            echo -e "${RED}❌ Redis (${REDIS_CONTAINER}) no está corriendo.${NC}"
            exit 1
        fi
        if ! docker ps --filter "name=${CADDY_CONTAINER}" --filter "status=running" -q | grep -q .; then
            echo -e "${RED}❌ Caddy (${CADDY_CONTAINER}) no está corriendo.${NC}"
            exit 1
        fi

        for TID in "${!TENANT_DIR[@]}"; do
            deploy_tenant "$TID"
            echo ""
        done

        update_caddy

        echo ""
        echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✅ TODOS LOS TENANTS DESPLEGADOS               ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
        echo ""
        show_status
        ;;

    *)
        # Desplegar un tenant específico
        TENANT_ID="$ACTION"

        # Verificar infraestructura
        if ! docker ps --filter "name=${REDIS_CONTAINER}" --filter "status=running" -q | grep -q .; then
            echo -e "${RED}❌ Redis (${REDIS_CONTAINER}) no está corriendo.${NC}"
            exit 1
        fi
        if ! docker ps --filter "name=${CADDY_CONTAINER}" --filter "status=running" -q | grep -q .; then
            echo -e "${RED}❌ Caddy (${CADDY_CONTAINER}) no está corriendo.${NC}"
            exit 1
        fi

        deploy_tenant "$TENANT_ID"
        update_caddy

        echo ""
        echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✅ DEPLOY COMPLETADO                           ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
        echo ""
        show_status

        echo -e "${YELLOW}${BOLD}⚠️  RECORDATORIO — DNS:${NC}"
        echo -e "   Asegurate de tener estos registros apuntando a la IP del VPS:"
        for TID in "${!TENANT_DIR[@]}"; do
            echo -e "   → ${CYAN}${TENANT_DOMAIN[$TID]}${NC}"
        done
        echo ""
        ;;
esac
