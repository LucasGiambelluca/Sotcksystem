@echo off
REM StockSystem - Diagnostic Script Simple
REM ============================================

echo ============================================
echo   StockSystem - VPS Diagnostic
echo ============================================
echo.
echo Host: 187.77.238.140
echo Usuario: root
echo.
echo INSTRUCCIONES:
echo 1. Cuando se abra la terminal, ingresa la password: stocksystem2026aA@
echo 2. Luego copia y ejecuta los comandos de abajo
echo.
echo ============================================
echo.

REM Abrir terminal SSH
cmd /k "ssh root@187.77.238.140"

REM Comandos para ejecutar (copiar uno por uno):
echo.
echo Comandos a ejecutar en el VPS:
echo -------------------------------------------
echo docker ps -a
echo docker images
echo ls -la /root/
echo cat /root/.env
echo find /opt /root /home -maxdepth 3 -name "*.yml" -o -name "*.yaml" 2^>nul
echo netstat -tlnp
echo free -h
echo df -h
echo cat /etc/caddy/Caddyfile
echo.
echo ============================================