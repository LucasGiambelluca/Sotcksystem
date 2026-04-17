# 🔍 DIAGNÓSTICO DEL SISTEMA DE NOTIFICACIONES WHATSAPP

**Fecha:** 2026-04-15  
**Auditor real:** Claude Code Analysis  
**Estado:** CRÍTICO - Requiere atención inmediata

---

## 📋 RESUMEN EJECUTIVO

El sistema de notificaciones de WhatsApp tiene **múltiples fallos críticos** que impiden su correcto funcionamiento:

1. **Problema CRÍTICO #1:** Las credenciales de WhatsApp Cloud API están comentadas en el archivo `.env`
2. **Problema CRÍTICO #2:** El sistema de deduplicación falla en entornos multi-instancia
3. **Problema CRÍTICO #3:** No hay separación correcta entre bots cuando hay múltiples instancias Docker
4. **Problema #4:** Race conditions entre Realtime y Polling
5. **Problema #5:** Mezcla inconsistente entre Baileys y API Oficial

---

## 🚨 PROBLEMAS IDENTIFICADOS

### 1. CREDENCIALES WHATSAPP NO CONFIGURADAS

**Archivo:** `whatsapp-server/.env` (líneas 25-30)

```bash
# --- PRUEBAS (mfm agent) - DESHABILITADO PARA QR ---
# WHATSAPP_PHONE_NUMBER_ID=1029241326937914
# WHATSAPP_BUSINESS_ACCOUNT_ID=1697371958377955
# WHATSAPP_CLOUD_TOKEN=EAAR1SW7ZAl6g...
# WHATSAPP_VERIFY_TOKEN=SotckSystemToken2026
# WHATSAPP_APP_ID=1254958159659920
```

**Impacto:**
- El `OfficialWhatsAppClient` no puede enviar mensajes (token vacío)
- El filtro multi-bot no funciona (`phoneIdInConfig` es `undefined`)
- Las órdenes se guardan sin `bot_id` correcto

**Evidencia de código:**
```typescript
// OfficialWhatsAppClient.ts:13
this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''; // → ''

// OrderService.ts:84
bot_id: process.env.WHATSAPP_PHONE_NUMBER_ID // → undefined
```

---

### 2. DEDUPLICACIÓN EN MEMORIA (NO PERSISTENTE)

**Archivo:** `whatsapp-server/src/api/routes/whatsapp.webhooks.ts` (líneas 10, 129-136)

```typescript
// In-memory deduplication (stores message IDs for 10 minutes)
const processedMessageIds = new Set<string>();
```

**Problema:**
- El `Set` vive solo en memoria de la instancia Node.js
- Si hay múltiples instancias Docker, cada una tiene su propio `Set`
- **Los mensajes duplicados de Meta pasan a través de cada instancia**

**Impacto:**
- Mensajes duplicados procesados en cada instancia
- Respuestas múltiples al cliente
- Posibles loops infinitos

---

### 3. SISTEMA DE PROCESAMIENTO DUPLICADO

**Archivo:** `OrderNotificationListener.ts` (líneas 189-252)

Existen **tres mecanismos simultáneos** procesando las mismas órdenes:

1. **Realtime Subscription:** Escucha cambios en tiempo real
2. **Polling de Cambios:** Cada 2 segundos (líneas 189-214)
3. **Polling de Nuevas Órdenes:** Cada 10 segundos (líneas 217-252)

```typescript
// Realtime
.channel(channelName)
.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, ...)

// Polling 1
setInterval(async () => { ... }, 2000);

// Polling 2
setInterval(async () => { ... }, 10000);
```

**Problema:**
- Race conditions entre los tres mecanismos
- Múltiples notificaciones para el mismo evento
- Sobrecarga de la base de datos

**Impacto:**
- Clientes reciben 2-3 mensajes por cada actualización de pedido
- Consumo excesivo de quota de Redis
- Latencia en la base de datos

---

### 4. FILTRO MULTI-BOT FALLIDO

**Archivo:** `OrderNotificationListener.ts` (líneas 374-378)

```typescript
// --- MULTI-BOT PROTECTION ---
const orderBotId = order.chat_context?.bot_id || order.metadata?.bot_id;
const myBotId = process.env.WHATSAPP_PHONE_NUMBER_ID;

if (orderBotId && myBotId && orderBotId !== myBotId) {
    logger.info(`[OrderNotificationListener] 🛡️ Ignoring order...`);
    return;
}
```

**Problema:**
- Si `WHATSAPP_PHONE_NUMBER_ID` no está configurado → `myBotId` es `undefined`
- La condición `orderBotId !== myBotId` siempre evalúa a `true` cuando `myBotId` es `undefined`
- **Nunca se filtran las órdenes correctamente**

**Escenario problemático:**
```
Instancia A (Bot 1): myBotId = undefined
Instancia B (Bot 2): myBotId = undefined

Orden creada por Bot 1: orderBotId = "1029241326937914"

En Instancia B:
- orderBotId = "1029241326937914"
- myBotId = undefined
- Comparación: "1029241326937914" !== undefined → true → IGNORA ✓

Pero si myBotId está undefined, el filtro puede fallar silenciosamente.
```

---

### 5. MEZCLA DE CLIENTES WHATSAPP

**Situación actual:**

El sistema tiene dos clientes de WhatsApp:

1. **Baileys Client** (`whatsappClient`): Para conexión vía QR/Pairing Code
2. **Official Cloud API Client** (`officialWhatsAppClient`): Para API oficial de Meta

**Problema:**

```typescript
// whatsapp.routes.ts:44-48
await whatsappClient.sendMessage(jid, { text: message });
// Usa Baileys

// whatsapp.webhooks.ts:182
await officialWhatsAppClient.sendMessage(phone, response);
// Usa API Cloud
```

**Impacto:**
- Configuración inconsistente entre componentes
- No se sabe cuál cliente se usa en cada caso
- Si Baileys está desconectado pero Cloud API configurado, fallan los envíos manuales desde el panel

---

### 6. REDIS DEDUPLICATION SIN FALLBACK

**Archivo:** `DeduplicationService.ts` (líneas 16-29)

```typescript
static async isDuplicate(key: string, ttlSeconds: number = 60): Promise<boolean> {
    try {
        const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
        return result === null;
    } catch (err) {
        logger.error(`[DeduplicationService] Error:`, err);
        return false; // ⚠️ FAIL OPEN - Permite duplicados si Redis falla
    }
}
```

**Problema:**
- Si Redis no está disponible, el servicio "falla abierto" (permite todo)
- Los duplicados pasan cuando Redis está saturado o caído

---

### 7. PROCESSED CHANGES NO PERSISTENTE

**Archivo:** `OrderNotificationListener.ts` (líneas 110-111)

```typescript
private processedChanges: Map<string, string> = new Map();
private processedNewOrders: Set<string> = new Set();
```

**Problema:**
- Estos objetos viven en memoria del proceso Node.js
- Si el servidor se reinicia, se pierde el historial de procesamiento
- Los eventos que ya se notificaron se procesan nuevamente

---

### 8. CANAL DE NOTIFICACIONES DE LOGÍSTICA SIN PROTECCIÓN MULTI-BOT

**Archivo:** `LogisticsNotificationListener.ts`

```typescript
// Este listener NO tiene filtro de bot_id
// Procesa TODOS los arribos de repartidores, sin verificar a qué local pertenecen

await whatsappClient.sendMessage(phone, { text: message });
```

**Impacto:**
- Las notificaciones de "repartidor llegó" se envían desde el bot incorrecto
- El cliente recibe mensajes del número equivocado

---

## 🔬 FLUJO DE FALLAS ACTUAL

```
┌─────────────────────────────────────────────────────────────┐
│  1. Cliente crea orden desde WhatsApp                      │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│  2. OrderService.createOrder() guarda orden              │
│     - chat_context.bot_id = undefined (env no configurado)│
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│  3. OrderNotificationListener detecta INSERT               │
│     - Realtime trigger inmediato                           │
│     - Polling (2s) detecta la misma orden                │
│     - Polling (10s) detecta la misma orden               │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│  4. handleStatusChange() ejecuta 3 veces                    │
│     - In-memory dedup: FALLA (primera vez en cada instancia)│
│     - Redis dedup: PARCIAL (puede fallar)                  │
│     - Envía 2-3 mensajes al cliente                        │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│  5. Multi-bot filter: FALLA                                 │
│     - myBotId = undefined                                  │
│     - Todas las instancias procesan la orden               │
│     - Cliente recibe mensajes de múltiples números         │
└──────────────────────────────────────────────────────────────┘
```

---

## ✅ SOLUCIONES PROPUESTAS

### SOLUCIÓN 1: Configurar Variables de Entorno (CRÍTICO)

**Archivo:** `whatsapp-server/.env`

```bash
# WhatsApp Cloud API (Oficial) - DESCOMENTAR Y CONFIGURAR
WHATSAPP_PHONE_NUMBER_ID=1029241326937914
WHATSAPP_BUSINESS_ACCOUNT_ID=1697371958377955
WHATSAPP_CLOUD_TOKEN=EAAR1SW7ZAl6gBRInZAtg1r...
WHATSAPP_VERIFY_TOKEN=SotckSystemToken2026
WHATSAPP_APP_ID=1254958159659920
BYPASS_SIGNATURE=false
```

**Validación:**
```bash
cd whatsapp-server
node -e "console.log('PHONE_ID:', process.env.WHATSAPP_PHONE_NUMBER_ID)"
```

---

### SOLUCIÓN 2: Deduplicación Persistente con Redis

**Reemplazar:** `whatsapp.webhooks.ts` (líneas 10, 129-136)

```typescript
import { redis } from '../config/database';

// Reemplazar Set en memoria con Redis
const DEDUPLICATION_TTL = 10 * 60; // 10 minutos en segundos

async function isDuplicateMessage(messageId: string): Promise<boolean> {
    const key = `wa:msg:${messageId}`;
    const result = await redis.set(key, '1', 'EX', DEDUPLICATION_TTL, 'NX');
    return result === null; // null = ya existía = duplicado
}
```

---

### SOLUCIÓN 3: Simplificar Sistema de Notificaciones

**Eliminar Polling innecesario** en `OrderNotificationListener.ts`:

```typescript
// ELIMINAR estos bloques:
// - Líneas 189-214: Polling fallback para updates
// - Líneas 217-252: Polling fallback para inserts

// MANTENER SOLO:
// - Realtime subscription (líneas 122-187)
// - Deduplication con Redis (ya implementado parcialmente)
```

**Razón:** Supabase Realtime es suficiente. El polling causa más problemas que soluciones.

---

### SOLUCIÓN 4: Reforzar Filtro Multi-Bot

**Modificar:** `OrderNotificationListener.ts` (líneas 374-378)

```typescript
private async handleStatusChange(orderId: string, newStatus: string) {
    // VALIDACIÓN: Requerir bot_id configurado
    const myBotId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!myBotId) {
        logger.error('[OrderNotificationListener] WHATSAPP_PHONE_NUMBER_ID no configurado');
        return;
    }

    const order = // ... fetch order
    
    // MULTI-BOT PROTECTION
    const orderBotId = order.chat_context?.bot_id || order.metadata?.bot_id;
    
    // Si la orden tiene bot_id y NO coincide con el mío, ignorarla
    if (orderBotId && orderBotId !== myBotId) {
        logger.info(`[OrderNotificationListener] 🛡️ Ignoring order ${orderId} - belongs to bot ${orderBotId}`);
        return;
    }
    
    // Si la orden NO tiene bot_id, verificar por CATALOG_SLUG
    if (!orderBotId) {
        const orderSlug = order.metadata?.catalog_slug || order.chat_context?.catalog_slug;
        const mySlug = process.env.CATALOG_SLUG;
        
        if (orderSlug && mySlug && orderSlug !== mySlug) {
            logger.info(`[OrderNotificationListener] 🛡️ Ignoring order by slug`);
            return;
        }
    }
}
```

---

### SOLUCIÓN 5: Unificar Cliente WhatsApp

**Crear:** `WhatsAppSender.ts` - Abstracción única

```typescript
export class WhatsAppSender {
    static async send(to: string, message: any): Promise<void> {
        const isOfficial = !!(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
        
        if (isOfficial) {
            await officialWhatsAppClient.sendMessage(to, message);
        } else {
            await whatsappClient.sendMessage(to, message);
        }
    }
}
```

**Reemplazar** todos los llamados directos a `whatsappClient` o `officialWhatsAppClient` con `WhatsAppSender.send()`.

---

### SOLUCIÓN 6: Persistencia de Procesamiento

**Reemplazar** `processedChanges` y `processedNewOrders` con Redis:

```typescript
// En lugar de:
private processedChanges: Map<string, string> = new Map();

// Usar:
private async markAsProcessed(orderId: string, status: string): Promise<void> {
    await redis.set(`notif:processed:${orderId}`, status, 'EX', 3600); // 1 hora
}

private async isProcessed(orderId: string, status: string): Promise<boolean> {
    const stored = await redis.get(`notif:processed:${orderId}`);
    return stored === status;
}
```

---

### SOLUCIÓN 7: Agregar Protección a LogisticsNotificationListener

**Modificar:** `LogisticsNotificationListener.ts` (línea 120+)

```typescript
private async handleArrival(orderId: string) {
    // VALIDACIÓN: Requerir bot_id
    const myBotId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!myBotId) {
        logger.error('[LogisticsNotificationListener] WHATSAPP_PHONE_NUMBER_ID no configurado');
        return;
    }
    
    const order = // ... fetch
    
    // MULTI-BOT FILTER
    const orderBotId = order.chat_context?.bot_id;
    if (orderBotId && orderBotId !== myBotId) {
        logger.info(`[LogisticsNotificationListener] 🛡️ Ignoring - belongs to bot ${orderBotId}`);
        return;
    }
    
    // ... resto del código
}
```

---

## 📊 PRIORIDADES DE IMPLEMENTACIÓN

| Prioridad | Solución | Esfuerzo | Impacto |
|-----------|----------|----------|---------|
| 🔴 P0 | Configurar .env | 5 min | CRÍTICO |
| 🔴 P0 | Filtro multi-bot | 30 min | CRÍTICO |
| 🟡 P1 | Unificar cliente WhatsApp | 2 horas | Alto |
| 🟡 P1 | Persistencia Redis | 1 hora | Alto |
| 🟢 P2 | Eliminar polling | 30 min | Medio |
| 🟢 P2 | Deduplicación webhook | 45 min | Medio |

---

## 🧪 VERIFICACIÓN POST-IMPLEMENTACIÓN

### Test 1: Configuración
```bash
cd whatsapp-server
npm run build
node -e "
  console.log('PHONE_ID:', process.env.WHATSAPP_PHONE_NUMBER_ID);
  console.log('SLUG:', process.env.CATALOG_SLUG);
  console.log('Is Official:', !!(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID));
"
```

### Test 2: Deduplicación
```bash
# Enviar mismo mensaje 3 veces
# Resultado esperado: Solo 1 mensaje recibido
```

### Test 3: Multi-bot
```bash
# Orden creada en Local A
# Resultado: Solo el Bot A debe notificar
# El Bot B debe ignorarla (log: "🛡️ Ignoring order...")
```

---

## 📝 NOTAS ADICIONALES

### Arquitectura Recomendada Multi-Bot

```
┌──────────────────────────────────────────────────────────┐
│                    VPS                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐       │
│  │  Docker Compose A   │  │  Docker Compose B   │       │
│  │  ─────────────────  │  │  ─────────────────  │       │
│  │  CATALOG_SLUG=loc1  │  │  CATALOG_SLUG=loc2  │       │
│  │  PHONE_ID=1029xxx   │  │  PHONE_ID=1088xxx   │       │
│  │  PORT=3001          │  │  PORT=3002          │       │
│  │  ─────────────────  │  │  ─────────────────  │       │
│  │  ┌───────────────┐│  │  ┌───────────────┐│       │
│  │  │   App Node    ││  │  │   App Node    ││       │
│  │  └───────┬───────┘│  │  └───────┬───────┘│       │
│  └──────────┼────────┘  └──────────┼────────┘       │
│             │                      │                 │
│  ┌──────────▼──────────────────────▼────────┐       │
│  │              Caddy Proxy                │       │
│  │   loc1.midominio.com → :3001            │       │
│  │   loc2.midominio.com → :3002          │       │
│  └─────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Supabase DB     │
                    │   (compartida)    │
                    └───────────────────┘
```

---

**Fin del diagnóstico**

*Generado automáticamente por Claude Code - StockSystem Audit*
