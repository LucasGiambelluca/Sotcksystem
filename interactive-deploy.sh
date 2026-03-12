#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=================================================${NC}"
echo -e "${GREEN}🚀 Asistente de Despliegue v2.0 - StockSystem${NC}"
echo -e "${CYAN}=================================================${NC}"

# 1. Recolectar Variables
echo -e "${YELLOW}Ingresá los datos de tu nuevo proyecto de Supabase:${NC}"
read -p "Dominio (ej: stocksystemspp.com): " DOMAIN_APP
read -p "URL Supabase (ej: https://bomzcidn.supabase.co): " SUPABASE_URL
read -p "Anon Key: " SUPABASE_ANON_KEY
read -p "Service Role Key: " SUPABASE_SERVICE_ROLE_KEY
read -p "JWT Secret (BUSCALO EN SUPABASE -> API -> JWT Settings): " JWT_SECRET
read -p "Database URL (postgresql://postgres:pass@host:5432/postgres): " DATABASE_URL

# Validar que el DATABASE_URL no tenga doble @@
DATABASE_URL=$(echo $DATABASE_URL | sed 's/@@/@/g')

# Configuración de URLs
FRONTEND_URL="https://$DOMAIN_APP"
API_URL="https://$DOMAIN_APP"
CORS_ORIGIN="https://$DOMAIN_APP"

# 2. Limpieza TOTAL de Docker (Para que no queden restos)
echo -e "${RED}🧹 Eliminando contenedores y volúmenes viejos...${NC}"
docker compose -f docker-compose.prod.yml down --volumes --remove-orphans || true

# 3. Crear el archivo .env definitivo (SIN COMENTARIOS QUE MOLESTEN)
cat > .env <<EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
VITE_API_URL=$API_URL
SUPABASE_URL=$SUPABASE_URL
SUPABASE_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL=$DATABASE_URL
JWT_SECRET=$JWT_SECRET
FRONTEND_URL=$FRONTEND_URL
CORS_ORIGIN=$CORS_ORIGIN
PORT=3001
NODE_ENV=production
EOF

# 4. Ajustar Caddyfile
echo -e "${YELLOW}Configurando Caddyfile...${NC}"
sed -i "s/TUDOMINIO.COM/$DOMAIN_APP/g" Caddyfile

# 5. Desplegar con Build Fresco
echo -e "${CYAN}🏗️ Construyendo aplicación (esto inyecta las variables en el frontend)...${NC}"
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

echo -e "${GREEN}✅ ¡SISTEMA ONLINE!${NC}"
echo -e "Accedé a: ${CYAN}$FRONTEND_URL/elpollocomilon/login${NC}"
echo -e "${YELLOW}Para el QR de WhatsApp ejecutá: ${NC}docker logs -f stock-app"