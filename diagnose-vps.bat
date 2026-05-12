@echo off
REM StockSystem VPS Diagnostic - Simple SSH Connection
REM ============================================

echo ============================================
echo   StockSystem VPS Diagnostic
echo ============================================
echo.
echo Se abrira una conexion SSH al VPS.
echo Cuando pida password: stocksystem2026aA@
echo.
echo Luego ejecuta los comandos de abajo:
echo.
echo ============================================
echo.

ssh -o StrictHostKeyChecking=no root@187.77.238.140

echo.
echo ============================================
echo Comandos a ejecutar en el VPS:
echo ============================================
echo.
echo [Copia y pega cada linea:]
echo.
echo docker ps -a
echo ls -la /root/
echo cat /root/.env 2^>dev^null
echo find / -maxdepth 3 -name "*docker-compose*" 2^>dev^null
echo netstat -tlnp ^| grep LISTEN
echo free -h
echo df -h
echo.
echo ============================================