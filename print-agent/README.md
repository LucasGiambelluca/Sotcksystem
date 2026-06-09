# Local Print Agent (reemplazo de RawBT)

Agente liviano que imprime los tickets sin depender de la app **RawBT**.
Corre en la **tablet Android del local** dentro de **Termux** y manda los
tickets directo a la impresora WiFi por TCP (puerto 9100).

```
Pedido → print_queue (Supabase)  ──poll──►  agent.js (Termux)  ──TCP 9100──►  Impresora 192.168.1.46
```

El `raw_content` que llega ya es un ticket ESC/POS completo (logo + texto +
corte), así que el agente es **TCP puro: sin librerías nativas** (nada de
escpos-usb / jimp), lo que lo hace fácil de correr en Termux.

> ⚠️ **Un solo consumidor.** Con este agente activo, deben quedar APAGADOS:
> - el puente RawBT del navegador (`PrinterBridge.tsx`, ya deshabilitado en el código),
> - el `whatsapp-server/scripts/printer-bridge.ts` (no correrlo en el VPS: no llega a la LAN).
> Si corre más de uno: se imprime doble o se marcan jobs como `failed`.

---

## Setup en Termux (una vez)

1. Instalar **Termux** (desde F-Droid, no Play Store — la de Play está desactualizada).

2. En Termux:
   ```sh
   pkg update && pkg upgrade -y
   pkg install nodejs git -y
   termux-setup-storage   # opcional, para acceder a archivos
   ```

3. Traer el agente (clonar el repo o copiar solo la carpeta `print-agent/`):
   ```sh
   git clone <REPO_URL>
   cd <REPO>/print-agent
   npm install
   ```

4. Configurar credenciales:
   ```sh
   cp .env.example .env
   nano .env          # pegar SUPABASE_SERVICE_KEY y confirmar PRINTER_IP
   ```

5. Probar:
   ```sh
   node agent.js
   ```
   Generá un pedido de prueba (o usá "Test Print" del panel) → debe salir el ticket.

---

## Que no se corte (Android Doze / pantalla apagada)

Android suspende procesos en segundo plano. Para que el agente siga vivo:

1. **Wake lock** (evita que Termux se duerma):
   ```sh
   pkg install termux-api -y     # + instalar la app "Termux:API"
   termux-wake-lock
   node agent.js
   ```

2. **Quitar optimización de batería** para Termux:
   Ajustes de Android → Apps → Termux → Batería → "Sin restricciones".

3. **Arranque automático** (que levante solo al prender la tablet):
   Instalar **Termux:Boot** (F-Droid). Crear `~/.termux/boot/start-printer.sh`:
   ```sh
   #!/data/data/com.termux/files/usr/bin/sh
   termux-wake-lock
   cd ~/<REPO>/print-agent && node agent.js
   ```
   ```sh
   chmod +x ~/.termux/boot/start-printer.sh
   ```

---

## Diagnóstico

- **No imprime nada:** ¿la tablet está en el mismo WiFi que la impresora?
  Probar conectividad: `ping 192.168.1.46`. Probar el puerto crudo:
  ```sh
  printf '\x1b\x40Hola\n\n\n\x1d\x56\x00' | nc 192.168.1.46 9100
  ```
  (`pkg install netcat-openbsd` para tener `nc`). Si sale "Hola", la impresora
  está OK y el problema es config/credenciales.
- **Imprime doble:** queda otro consumidor activo (RawBT en el navegador o el
  bridge del VPS). Apagarlos.
- **Jobs en `failed`:** ver `error_message` en la tabla `print_queue`.
  `printer socket timeout` = la tablet no alcanza la impresora (WiFi/IP).
