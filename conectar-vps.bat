@echo off
REM StockSystem - Conexion directa al VPS
REM ============================================

echo ============================================
echo   StockSystem - Conexion al VPS
echo ============================================
echo.
echo Servidor: 187.77.238.140
echo Usuario: root
echo Password: stocksystem2026aA@
echo.
echo ============================================
echo.

REM Abrir conexion SSH directa - el usuario ingresa password cuando se lo pida
start cmd /k "ssh -o StrictHostKeyChecking=no root@187.77.238.140"

echo.
echo Cuando te pida la password: stocksystem2026aA@
echo.
echo Luego ejecuta estos comandos uno por uno:
echo.
echo   docker ps -a
echo   ls -la /root/
echo   cat /root/.env
echo   netstat -tlnp
echo   cat /etc/caddy/Caddyfile
echo.
echo ============================================
pause