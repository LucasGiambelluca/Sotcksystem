#!/bin/bash
# StockSystem VPS Connect & Diagnostic
# Usage: ./connect-vps.sh

HOST="187.77.238.140"
USER="root"

echo "==========================================="
echo "  StockSystem VPS Diagnostic"
echo "==========================================="
echo ""
echo "Host: $HOST"
echo "User: $USER"
echo ""
echo "Cuando pida password: stocksystem2026aA@"
echo ""
echo "==========================================="
echo ""

ssh -o StrictHostKeyChecking=no $USER@$HOST

# Comandos a ejecutar automáticamente después de conectar
echo ""
echo "Ejecutando comandos de diagnóstico..."
echo ""

ssh -o StrictHostKeyChecking=no $USER@$HOST << 'COMMANDS'
echo "=== CONTENEDORES ==="
docker ps -a

echo ""
echo "=== IMAGENES ==="
docker images

echo ""
echo "=== CARPETAS ==="
ls -la /opt/ 2>/dev/null
ls -la /root/ 2>/dev/null

echo ""
echo "=== PUERTOS ==="
netstat -tlnp 2>/dev/null | grep LISTEN

echo ""
echo "=== ENV ==="
cat /root/.env 2>/dev/null | head -30

echo ""
echo "=== CADDYFILE ==="
cat /etc/caddy/Caddyfile 2>/dev/null

echo ""
echo "=== MEMORIA ==="
free -h
COMMANDS