#!/bin/bash
# interactive-deploy.sh
# Asistente de Configuración y Despliegue de StockSystem en VPS

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=================================================${NC}"
echo -e "${GREEN}🚀 Asistente de Despliegue - StockSystem VPS${NC}"
echo -e "${CYAN}=================================================${NC}"
echo ""

# 1. Verificar dependencias
echo -e "${YELLOW}Verificando dependencias esenciales...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado. Instalándolo...${NC}"
    curl -fsSL https://get.docker.com | sh
else
    echo -e "${GREEN}✅ Docker está instalado.${NC}"
fi

if ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}Instalando plugin Docker Compose...${NC}"
    apt-get update && apt-get install -y docker-compose-plugin || true
fi

# 2. Recolectar Variables de Entorno Interactivamente
echo ""
echo -e "${CYAN}📝 CONFIGURACIÓN DE SUPABASE Y SISTEMA${NC}"
echo -e "${YELLOW}Por favor, ingresá los datos solicitados. Los podés encontrar en tu panel de Supabase.${NC}"
echo ""

read -p "Dominio de la Aplicación (ej: stocksystemapp.com) [Dejar vacío para usar IP local]: " DOMAIN_APP

echo ""
read -p "URL de Supabase (ej: https://xxx.supabase.co): " SUPABASE_URL
read -p "Anon Key de Supabase: " SUPABASE_ANON_KEY
read -p "Service Role Key de Supabase (Para el backend): " SUPABASE_SERVICE_ROLE_KEY
read -p "Database URL (ej: postgresql://postgres.xxx...): " DATABASE_URL

# Configuración automática del entorno
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "default_secret_please_change_later_123456789")

if [ -z "$DOMAIN_APP" ]; then
    echo -e "${YELLOW}Usando configuración para IP / Localhost (Sin Dominio).${NC}"
    FRONTEND_URL="http://localhost:3001"
    API_URL="http://localhost:3001"
    CORS_ORIGIN="http://localhost:3001"
    
    # Ajustar Caddyfile para modo sin dominio
    sed -i 's/^TUDOMINIO.COM/# TUDOMINIO.COM/' Caddyfile
    sed -i 's/# :80 {/:80 {/' Caddyfile
    sed -i 's/#     reverse_proxy app:3001/    reverse_proxy app:3001/' Caddyfile
    sed -i 's/# }/}/' Caddyfile
else
    echo -e "${GREEN}Usando configuración para Dominio ($DOMAIN_APP).${NC}"
    FRONTEND_URL="https://$DOMAIN_APP"
    API_URL="https://$DOMAIN_APP"
    CORS_ORIGIN="https://$DOMAIN_APP"
    
    # Reemplazar dominio en el Caddyfile
    sed -i "s/TUDOMINIO.COM/$DOMAIN_APP/" Caddyfile
fi

# 3. Crear el archivo .env definitivo
echo ""
echo -e "${YELLOW}Creando archivo .env general...${NC}"
cat > .env <<EOF
# ============================================
# ARCHIVO AUTO-GENERADO POR interactive-deploy.sh
# ============================================

# Frontend Config
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
VITE_API_URL=$API_URL

# Backend Config
SUPABASE_URL=$SUPABASE_URL
SUPABASE_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL=$DATABASE_URL
JWT_SECRET=$JWT_SECRET

# Server Config
FRONTEND_URL=$FRONTEND_URL
CORS_ORIGIN=$CORS_ORIGIN
PORT=3001
NODE_ENV=production
EOF
echo -e "${GREEN}Archivo .env creado con éxito.${NC}"

# 4. Desplegar los contenedores
echo ""
echo -e "${CYAN}=================================================${NC}"
echo -e "${YELLOW}🏗️ Construyendo y levantando la plataforma...${NC}"
echo -e "${YELLOW}(Esto puede tardar varios minutos la primera vez)${NC}"

docker compose -f docker-compose.prod.yml down || true
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

echo ""
echo -e "${GREEN}✅ ¡Despliegue completado!${NC}"
echo ""
echo -e "Tu panel de administración debería estar accesible en: ${CYAN}$FRONTEND_URL${NC}"
echo ""
echo -e "${YELLOW}⚠️ IMPORTANTE: PARA CONECTAR EL BOT DE WHATSAPP${NC}"
echo -e "Ejecutá este comando para ver el código QR en la consola:"
echo -e "${CYAN}docker compose -f docker-compose.prod.yml logs -f tail=100 backend${NC}"
echo -e "Escaneá el código QR usando 'Dispositivos Vinculados' en tu WhatsApp."
echo ""
