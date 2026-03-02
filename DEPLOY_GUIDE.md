# 🚀 Guía de Deploy — StockSystem en Hostinger KVM

## Requisitos
- VPS Hostinger KVM 2 (Ubuntu 22.04 LTS)
- Un dominio propio (recomendado) o usar la IP pública del servidor
- Git instalado localmente
- El repositorio del proyecto en GitHub/GitLab

---

## PASO 1 — Conectarse al servidor por SSH

```bash
# Desde tu PC (PowerShell o terminal)
ssh root@IP_DE_TU_SERVIDOR

# Primera vez: Hostinger te envía la contraseña root por email
# Luego configurar SSH keys para mayor seguridad (recomendado)
```

---

## PASO 2 — Instalar dependencias en el servidor

```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Instalar Docker Compose plugin
apt install -y docker-compose-plugin

# Verificar instalación
docker --version
docker compose version

# Instalar Git
apt install -y git
```

---

## PASO 3 — Clonar el repositorio

```bash
# Crear directorio de la app
mkdir -p /opt/stocksystem
cd /opt/stocksystem

# Clonar tu repo (reemplazá con tu URL)
git clone https://github.com/TUUSUARIO/Sotcksystem.git .
```

---

## PASO 4 — Configurar variables de entorno

```bash
# Crear el .env desde el template
cp .env.example .env

# Editar con tus valores reales
nano .env
```

### Valores que DEBÉS completar en el `.env`:

| Variable | Dónde obtenerla |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon key |
| `SUPABASE_URL` | Igual que arriba |
| `SUPABASE_KEY` | Supabase → API → anon key |
| `SUPABASE_SERVICE_KEY` | Supabase → API → service_role key ⚠️ |
| `DATABASE_URL` | Supabase → Project Settings → Database → URI |
| `JWT_SECRET` | Generalo: `openssl rand -hex 32` |
| `VITE_API_URL` | `https://api.TUDOMINIO.COM` |
| `CORS_ORIGIN` | `https://panel.TUDOMINIO.COM` |
| `FRONTEND_URL` | `https://panel.TUDOMINIO.COM` |

---

## PASO 5 — Configurar dominio y Caddyfile

### Si tenés dominio:
1. En tu proveedor de DNS, crear dos registros tipo **A**:
   - `panel.TUDOMINIO.COM` → IP de tu servidor Hostinger
   - `api.TUDOMINIO.COM` → IP de tu servidor Hostinger

2. Editar el `Caddyfile` en el servidor:
```bash
nano /opt/stocksystem/Caddyfile
# Reemplazar TUDOMINIO.COM con tu dominio real
```

### Si NO tenés dominio (IP directa):
En el `Caddyfile`, descomentar la sección `# :80 {` y comentar las secciones con dominio.
En `.env`, poner:
```
VITE_API_URL=http://IP_DEL_SERVIDOR:3001
CORS_ORIGIN=http://IP_DEL_SERVIDOR:8080
```
Y usar `docker-compose.yml` en lugar de `docker-compose.prod.yml`.

---

## PASO 6 — Build y arranque

```bash
cd /opt/stocksystem

# Construir imágenes (tarda 3-8 minutos la primera vez)
docker compose -f docker-compose.prod.yml build --no-cache

# Arrancar todos los servicios en background
docker compose -f docker-compose.prod.yml up -d

# Verificar que todos estén corriendo
docker compose -f docker-compose.prod.yml ps
```

**Salida esperada:**
```
NAME             STATUS
stock-caddy      running
stock-frontend   running (healthy)
stock-backend    running (healthy)
stock-redis      running (healthy)
```

---

## PASO 7 — Conectar WhatsApp (⚠️ Importante)

```bash
# Ver logs del backend en tiempo real
docker compose -f docker-compose.prod.yml logs backend -f

# El QR de WhatsApp aparece en la terminal como texto ASCII
# Escanearlo con el teléfono: WhatsApp → ⋮ → Dispositivos vinculados → Vincular dispositivo
```

> 💡 **El QR solo aparece la primera vez.** Una vez escaneado, Baileys guarda la sesión en el volumen `baileys_sessions` y no vuelve a pedirlo aunque reinicies.

---

## PASO 8 — Verificación final

```bash
# Verificar que el backend responde y WhatsApp está conectado
curl https://api.TUDOMINIO.COM/health

# Respuesta esperada:
# { "status": "healthy", "checks": { "whatsapp": true, "whatsapp_status": "WORKING" }, ... }
```

Abrir en el navegador:
- **Panel:** `https://panel.TUDOMINIO.COM`
- Hacer login con las credenciales de Supabase Auth
- Enviar un mensaje al número del bot para verificar la respuesta automática

---

## Comandos útiles post-deploy

```bash
# Ver logs en tiempo real
docker compose -f docker-compose.prod.yml logs -f

# Reiniciar solo el backend (ej: después de actualizar código)
docker compose -f docker-compose.prod.yml restart backend

# Actualizar código del servidor
cd /opt/stocksystem
git pull
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml up -d

# Ver uso de recursos
docker stats
```

---

## Notas de seguridad

- Nunca versionar el archivo `.env` (ya está en `.gitignore`)
- El `SUPABASE_SERVICE_KEY` es solo para el backend — nunca en el frontend
- Configurar firewall: solo abrir puertos 22 (SSH), 80 (HTTP), 443 (HTTPS)
```bash
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable
```
