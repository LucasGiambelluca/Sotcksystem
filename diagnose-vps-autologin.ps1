$HOST = "187.77.238.140"
$USER = "root"
$PASSWORD = "stocksystem2026aA@"

# Crear archivo de script expect-like
$scriptContent = @"
spawn ssh -o StrictHostKeyChecking=no $USER@$HOST
expect "password:"
send "$PASSWORD`r"
expect "~$"
send "echo '===== DIAGNOSTICO COMPLETO =====' && docker ps -a && ls -la /root/ && cat /root/.env 2>/dev/null && netstat -tlnp 2>/dev/null && free -h`r"
expect "$USER@"
send "exit`r"
expect eof
"@

# Escribir script temporal
$scriptContent | Out-File -FilePath $env:TEMP\ssh_diag.ps1 -Encoding UTF8

# Ahora intentar ejecutar
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "  StockSystem VPS Diagnostic" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Host: $HOST"
Write-Host "User: $USER"
Write-Host ""
Write-Host "Esto intentará conectar automáticamente..." -ForegroundColor Yellow
Write-Host ""

# Intentar con ssh usando input pipe
try {
    $sshProcess = New-Object System.Diagnostics.Process
    $sshProcess.StartInfo.FileName = "ssh"
    $sshProcess.StartInfo.Arguments = "-o StrictHostKeyChecking=no -o BatchMode=no $USER@$HOST"
    $sshProcess.StartInfo.UseShellExecute = $false
    $sshProcess.StartInfo.RedirectStandardInput = $true
    $sshProcess.StartInfo.RedirectStandardOutput = $true
    $sshProcess.StartInfo.RedirectStandardError = $true
    $sshProcess.StartInfo.CreateNoWindow = $true

    $sshProcess.Start() | Out-Null

    # Escribir password
    $sshProcess.StandardInput.WriteLine($PASSWORD)
    $sshProcess.StandardInput.Close()

    # Esperar hasta 30 segundos
    $sshProcess.WaitForExit(30000)

    $output = $sshProcess.StandardOutput.ReadToEnd()
    $error = $sshProcess.StandardError.ReadToEnd()

    if ($output) {
        Write-Host $output -ForegroundColor White
    } else {
        Write-Host "Output vacío o solo error: $error" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Si no funcionó, ejecuta manualmente:" -ForegroundColor Yellow
Write-Host '  ssh root@187.77.238.140' -ForegroundColor White
Write-Host "Password: stocksystem2026aA@" -ForegroundColor White
Write-Host ""
pause