# StockSystem VPS Diagnostic Script
# Ejecutar en PowerShell: .\diagnose-vps.ps1

param(
    [string]$Host = "187.77.238.140",
    [string]$User = "root"
)

$ErrorActionPreference = "Continue"

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "  StockSystem VPS Diagnostic" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Solicitar contraseña
$Password = Read-Host -Prompt "Ingresa la password del VPS" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::BSTRToString($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

Write-Host "`n[1/6] Conectando al VPS..." -ForegroundColor Yellow

# Función para ejecutar comando SSH
function Invoke-SSHCommand {
    param($Cmd)
    $output = ""
    $errOutput = ""

    # Intentar con ssh usando expect-like approach
    $tempScript = [System.IO.Path]::GetTempFileName() + ".ps1"

    $sshCmd = "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o PreferredAuthentications=password -o PubkeyAuthentication=no $User@$Host `"$Cmd`""

    # Usar proceso con input
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "ssh"
    $processInfo.Arguments = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o PreferredAuthentications=password -o PubkeyAuthentication=no $User@$Host $Cmd"
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardInput = $true
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($processInfo)
    $proc.StandardInput.WriteLine($PlainPassword)
    $proc.StandardInput.Close()
    $proc.WaitForExit(30000)

    $output = $proc.StandardOutput.ReadToEnd()
    $errOutput = $proc.StandardError.ReadToEnd()

    return $output
}

# Primero, testar conexión
$testResult = & ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 $User@$Host "echo CONNECTION_OK" 2>&1

if ($testResult -like "*CONNECTION_OK*") {
    Write-Host "[OK] Conexión exitosa!" -ForegroundColor Green
} else {
    Write-Host "[ERROR] No se pudo conectar. Verificando con contraseña interactiva..." -ForegroundColor Red

    # Intentar con ssh interactivo
    Write-Host ""
    Write-Host "Ejecuta manualmente en tu terminal:" -ForegroundColor Yellow
    Write-Host "  ssh root@187.77.238.140" -ForegroundColor White
    Write-Host ""
    Write-Host "Cuando pida password, ingresa: stocksystem2026aA@" -ForegroundColor White
    Write-Host ""
    Write-Host "Luego copia y ejecuta estos comandos:" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "`n[2/6] Detectando contenedores Docker..." -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Cyan

$cmd1 = @'
echo "=== CONTENEDORES DOCKER ==="
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "=== IMAGENES DOCKER ==="
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo ""
echo "=== VOLUMENES DOCKER ==="
docker volume ls
echo ""
echo "=== REDES DOCKER ==="
docker network ls
'@

$result1 = & ssh -o StrictHostKeyChecking=no $User@$Host $cmd1 2>&1
Write-Host $result1

Write-Host "`n[3/6] Detectando estructura de archivos..." -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Cyan

$cmd2 = @'
echo "=== DIRECTORIO /opt ==="
ls -la /opt/ 2>/dev/null || echo "No existe /opt/"
echo ""
echo "=== DIRECTORIO /var/www ==="
ls -la /var/www/ 2>/dev/null || echo "No existe /var/www/"
echo ""
echo "=== HOME DEL USUARIO ==="
ls -la ~/ 2>/dev/null
echo ""
echo "=== CARPETAS RELACIONADAS ==="
find /home /root /opt /var/www -maxdepth 2 -name "*stock*" -o -name "*whatsapp*" -o -name "*bot*" 2>/dev/null | Select -First 20
'@

$result2 = & ssh -o StrictHostKeyChecking=no $User@$Host $cmd2 2>&1
Write-Host $result2

Write-Host "`n[4/6] Detectando configuración de red..." -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Cyan

$cmd3 = @'
echo "=== PUERTOS EN USO ==="
netstat -tlnp 2>/dev/null | grep -E "LISTEN" || ss -tlnp | grep LISTEN
echo ""
echo "=== IP PÚBLICA ==="
curl -s ifconfig.me && echo ""
echo "=== DOMINIOS CONFIGURADOS ==="
cat /etc/caddy/Caddyfile 2>/dev/null | head -30 || echo "No hay Caddyfile"
echo ""
echo "=== NGINX CONFIG (si existe) ==="
cat /etc/nginx/sites-enabled/* 2>/dev/null | head -30 || echo "No hay nginx config"
'@

$result3 = & ssh -o StrictHostKeyChecking=no $User@$Host $cmd3 2>&1
Write-Host $result3

Write-Host "`n[5/6] Detectando archivos de configuración..." -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Cyan

$cmd4 = @'
echo "=== ARCHIVOS .ENV ==="
find /root /home /opt /var -name ".env" -type f 2>/dev/null | Select -First 10
echo ""
echo "=== CONTENIDO .ENV PRINCIPAL ==="
cat /root/.env 2>/dev/null | head -40 || cat ~/stock*/.env 2>/dev/null | head -40 || cat ~/.env 2>/dev/null | head -40 || echo "No se encontró .env"
echo ""
echo "=== DOCKER-COMPOSE YML ==="
find /root /opt /var/www -name "docker-compose*.yml" -o -name "docker-compose*.yaml" 2>/dev/null
'@

$result4 = & ssh -o StrictHostKeyChecking=no $User@$Host $cmd4 2>&1
Write-Host $result4

Write-Host "`n[6/6] Detectando servicios y procesos..." -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Cyan

$cmd5 = @'
echo "=== SERVICIOS SYSTEMD ==="
systemctl list-units --type=service --state=running 2>/dev/null | grep -E "caddy|nginx|docker|pm2|node" || echo "systemd no disponible"
echo ""
echo "=== PROCESOS NODE/PM2 ==="
ps aux | grep -E "node|pm2" | grep -v grep | head -20
echo ""
echo "=== MEMORIA Y DISCO ==="
free -h
echo ""
df -h / /var /home 2>/dev/null | head -10
'@

$result5 = & ssh -o StrictHostKeyChecking=no $User@$Host $cmd5 2>&1
Write-Host $result5

Write-Host "`n===========================================" -ForegroundColor Cyan
Write-Host "  Diagnóstico completado!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Copia y pega el output completo aquí." -ForegroundColor Yellow
Write-Host "También puedes ejecutar manualmente:" -ForegroundColor Yellow
Write-Host ""
Write-Host '  ssh root@187.77.238.140 "docker ps && ls -la /root/"' -ForegroundColor White
Write-Host ""