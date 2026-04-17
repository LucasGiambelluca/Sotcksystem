# 🏗️ REDISEÑO DEL SISTEMA DE NOTIFICACIONES

## Arquitectura Escalable Multi-Bot para StockSystem

**Versión:** 2.0  
**Fecha:** 2026-04-15  
**Objetivo:** Soportar 1000+ pedidos/hora con múltiples bots sin interferencias

---

## 📚 CONTEXTO DEL SISTEMA ACTUAL

### ¿Qué es StockSystem?

StockSystem es una **plataforma de gestión de pedidos y ventas** diseñada para locales gastronómicos (rotiserías, restaurantes, food trucks). El sistema permite:

- **Tomar pedidos** vía WhatsApp (Bot), Web (Catálogo), o Tablet (Punto de venta)
- **Gestionar el flujo de preparación** (KitchenFlow) con estados de pedido
- **Imprimir comandas** automáticamente en impresoras térmicas
- **Administrar inventario** y stock de productos
- **Coordinar reparto** con sistema de logística

### Arquitectura General del Proyecto

```
C:\Users\Lucas\Desktop\Sotcksystem\                 ← Código fuente
│
├── whatsapp-server/                                ← Backend Node.js
│   ├── src/
│   │   ├── api/                                   ← Rutas REST
│   │   │   ├── routes/whatsapp.webhooks.ts        ← Webhooks de Meta
│   │   │   ├── routes/whatsapp.routes.ts          ← API interna
│   │   │   └── routes/printer.routes.ts           ← API de impresoras
│   │   ├── services/                              ← Lógica de negocio
│   │   │   ├── OrderNotificationListener.ts       ← Sistema de notificaciones actual (PROBLEMA)
│   │   │   ├── PrinterService.ts                  ← Genera tickets ESC/POS
│   │   │   ├── PrinterBridgeService.ts            ← Imprime tickets
│   │   │   ├── OrderService.ts                      ← Crea pedidos
│   │   │   └── DeduplicationService.ts            ← Deduplicación Redis básica
│   │   ├── core/                                  ← Motor de flujos
│   │   │   ├── engine/flow.engine.ts              ← Orquestador de bots
│   │   │   ├── agent/AgentNode.ts                 ← Agente de IA
│   │   │   └── executors/                         ← Nodos del bot
│   │   └── infrastructure/
│   │       ├── whatsapp/
│   │       │   ├── WhatsAppClient.ts              ← Baileys (legacy)
│   │       │   └── OfficialWhatsAppClient.ts      ← API Cloud Meta
│   │       └── persistence/
│   │           └── RedisPersistenceService.ts      ← Cache de sesiones
│   └── .env                                        ← Configuración del bot
│
├── client/                                         ← Frontend React
│   └── src/services/
│       └── whatsappService.ts                     ← Envío desde panel
│
├── supabase/
│   └── migrations/                                 ← Esquema de base de datos
│       ├── 20260216_kitchenflow.sql               ← KitchenFlow system
│       └── 20260329_thermal_printer.sql           ← Sistema de impresión
│
└── docker-compose.yml                              ← Docker local
```

---

## 🗄️ BASE DE DATOS Y TABLAS PRINCIPALES

### Tablas Core del Sistema

#### 1. `orders` - Pedidos
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    order_number SERIAL,                     -- Número visible del pedido (#1234)
    client_id UUID REFERENCES clients(id),
    phone VARCHAR(50),                       -- Teléfono del cliente
    status VARCHAR(30),                      -- PENDING, CONFIRMED, IN_PREPARATION, etc.
    channel VARCHAR(20),                     -- WHATSAPP, WEB, TABLET
    total_amount DECIMAL(10,2),
    delivery_fee DECIMAL(10,2),
    delivery_address TEXT,
    delivery_type VARCHAR(20),               -- DELIVERY, PICKUP
    assigned_to UUID REFERENCES users(id), -- Preparador asignado
    chat_context JSONB,                      -- 👈 AQUÍ SE GUARDA bot_id, catalog_slug
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**Campos clave para notificaciones:**
- `chat_context`: JSON que contiene `bot_id` (identifica qué bot creó el pedido)
- `phone`: Número de WhatsApp del cliente
- `status`: Estado actual (triggers notificaciones)
- `channel`: Solo notificar si es WHATSAPP o WEB (no TABLET)

#### 2. `order_items` - Items de Pedidos
```sql
CREATE TABLE order_items (
    id UUID PRIMARY KEY,
    order_id UUID REFERENCES orders(id),
    catalog_item_id UUID REFERENCES catalog_items(id),
    quantity INTEGER,
    unit_price DECIMAL(10,2)
);
```

#### 3. `clients` - Clientes
```sql
CREATE TABLE clients (
    id UUID PRIMARY KEY,
    phone VARCHAR(50) UNIQUE,
    name VARCHAR(100),
    last_address TEXT                        -- Para autocompletar dirección
);
```

#### 4. `print_queue` - Cola de Impresión
```sql
CREATE TABLE print_queue (
    id UUID PRIMARY KEY,
    order_id UUID REFERENCES orders(id),
    raw_content TEXT,                      -- Base64 de comandos ESC/POS
    status VARCHAR(20),                      -- pending, printed, failed
    error_message TEXT,
    created_at TIMESTAMP,
    printed_at TIMESTAMP
);
```

**Realtime enabled:** Cuando se inserta un registro, el `PrinterBridgeService` lo detecta e imprime automáticamente.

#### 5. `whatsapp_conversations` - Conversaciones
```sql
CREATE TABLE whatsapp_conversations (
    id UUID PRIMARY KEY,
    phone VARCHAR(50),
    contact_name VARCHAR(100),
    status VARCHAR(20),                      -- ACTIVE, HANDOVER, BOT
    unread_count INTEGER,
    last_message TEXT,
    last_message_at TIMESTAMP
);
```

#### 6. `flow_executions` - Sesiones del Bot
```sql
CREATE TABLE flow_executions (
    id UUID PRIMARY KEY,
    session_id VARCHAR(100),                 -- "1to1:5491123456789"
    phone VARCHAR(50),
    flow_id UUID REFERENCES flows(id),
    current_node_id VARCHAR(50),
    status VARCHAR(20),                      -- active, waiting_input, completed
    context JSONB,                          -- Variables de la conversación
    version INTEGER,                        -- Optimistic locking
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### 7. `notifications` - Notificaciones Internas
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    title VARCHAR(100),
    message TEXT,
    type VARCHAR(30),                       -- DELIVERY_CONFIRMED, LOW_STOCK, etc.
    metadata JSONB,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP
);
```

---

## 🔄 FLUJO COMPLETO DE UN PEDIDO

### Escenario: Cliente pide por WhatsApp

```
1. CLIENTE escribe "Hola, quiero 2 empanadas de carne"
   │
   ▼
2. META API → Webhook → whatsapp-server
   │
   ▼
3. conversation.router.ts procesa mensaje
   │
   ▼
4. FlowEngine (core/engine/flow.engine.ts) ejecuta flujo "Tomar Pedido"
   │
   ├─ aiAgentNode: Entiende intención y productos
   ├─ orderValidatorNode: Valida items
   ├─ createOrderNode: Crea pedido en DB
   │
   ▼
5. OrderService.createOrder() inserta en tabla orders
   │   - Guarda bot_id en chat_context
   │   - Crea order_items
   │
   ▼
6. TRIGGER EN DB (Realtime + Polling)
   │
   ├─ OrderNotificationListener detecta INSERT
   │  ├─ Si auto_print_enabled → queueOrderTicket()
   │  │   → Inserta en print_queue
   │  │
   │  ├─ Si auto_accept → Actualiza a IN_PREPARATION
   │  │
   │  └─ Envia notificación WhatsApp al cliente
   │
   ├─ PrinterBridgeService detecta print_queue INSERT
   │  → Imprime ticket físico
   │
   └─ KitchenFlow (cocina) ve pedido en dashboard
   │
   ▼
7. PREPARADOR actualiza estado en dashboard
   │   PENDING → IN_PREPARATION → OUT_FOR_DELIVERY → DELIVERED
   │
   ▼
8. OrderNotificationListener detecta cada UPDATE
   → Envia notificación WhatsApp al cliente por cada cambio
```

---

## 🛠️ SERVICIOS ACTUALES INVOLUCRADOS

### 1. OrderNotificationListener (El problema principal)

**Ubicación:** `whatsapp-server/src/services/OrderNotificationListener.ts`

**Responsabilidades actuales:**
- Escucha cambios en tabla `orders` (Realtime + Polling)
- Envía notificaciones WhatsApp al cliente
- Triggers auto-print de comandas
- Triggers auto-accept de pedidos

**Problemas actuales:**
```typescript
// 1. Deduplicación en MEMORIA (falla con Docker)
private processedChanges: Map<string, string> = new Map();
private processedNewOrders: Set<string> = new Set();

// 2. Tres mecanismos duplicados:
//    - Realtime subscription
//    - Polling cada 2 segundos
//    - Polling cada 10 segundos

// 3. Filtro multi-bot fallible:
const myBotId = process.env.WHATSAPP_PHONE_NUMBER_ID; // undefined si no configura
if (orderBotId && myBotId && orderBotId !== myBotId) {
    // Solo funciona si ambos están configurados
}
```

### 2. PrinterService + PrinterBridgeService

**Flujo de impresión:**
1. `OrderNotificationListener` detecta nueva orden
2. Llama a `PrinterService.queueOrderTicket(orderId)`
3. `PrinterService` genera ESC/POS y guarda en `print_queue`
4. `PrinterBridgeService` escucha INSERTs en `print_queue`
5. Imprime ticket físico y marca como `printed`

### 3. WhatsApp Clients

**Baileys (legacy):** `whatsapp-server/src/infrastructure/whatsapp/WhatsAppClient.ts`
- Conexión via QR/Pairing Code
- Usado principalmente en desarrollo local

**Official API:** `whatsapp-server/src/infrastructure/whatsapp/OfficialWhatsAppClient.ts`
- API Cloud de Meta (recomendado para producción)
- Requiere: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_CLOUD_TOKEN`

**Problema:** El sistema mezcla ambos sin abstracción clara.

### 4. DeduplicationService

**Ubicación:** `whatsapp-server/src/services/DeduplicationService.ts`

```typescript
// Usa Redis para deduplicación - ESTO FUNCIONA BIEN
static async isDuplicate(key: string, ttlSeconds: number = 60): Promise<boolean> {
    const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === null;
}
```

Este servicio **sí usa Redis** correctamente, pero el `OrderNotificationListener` no lo aprovecha completamente.

---

## 🏗️ INFRAESTRUCTURA ACTUAL

### Docker Compose (VPS)

```yaml
# docker-compose.eldelirio.yml
services:
  app:
    container_name: eldelirio-app
    ports:
      - "3002:3001"                    # Bot 1: Puerto 3002
    environment:
      - WHATSAPP_PHONE_NUMBER_ID=...   # ID del Bot 1
      - CATALOG_SLUG=eldelirio
      - REDIS_URL=redis://redis:6379
    
  redis:
    image: redis:7-alpine              # Redis compartido (PROBLEMA)
```

```yaml
# docker-compose.otrolocal.yml
services:
  app:
    container_name: otrolocal-app
    ports:
      - "3001:3001"                    # Bot 2: Puerto 3001
    environment:
      - WHATSAPP_PHONE_NUMBER_ID=...   # ID del Bot 2
      - CATALOG_SLUG=otrolocal
      - REDIS_URL=redis://redis:6379   # MISMO Redis
```

**Problema:** Ambos bots comparten el mismo Redis sin prefijos de aislamiento.

---

## 📊 ANÁLISIS DE REQUERIMIENTOS

### Métricas Actuales (Problemas)
| Métrica | Actual | Objetivo |
|---------|--------|----------|
| Pedidos/hora | ~50 | 1000+ |
| Latencia promedio | 3-5s | <500ms |
| Duplicados | 15-20% | <0.1% |
| Disponibilidad | 85% | 99.9% |
| Mensajes perdidos | 5-10% | <0.01% |

### Escenarios de Estrés
- **Picos de horario:** 50 pedidos en 5 minutos
- **Eventos promocionales:** 200 pedidos en 15 minutos
- **Múltiples locales:** 5 bots en mismo servidor, cada uno independiente
- **Fallos de red:** Reintentos automáticos sin duplicados

---

## 🏛️ ARQUITECTURA PROPUESTA

### Patrón: Event-Driven Architecture + CQRS + Multi-Tenant Isolation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CAPA DE INGESTA                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  Webhook Meta   │  │   API Panel     │  │   WebSocket     │         │
│  │   (Entrada)     │  │  (Manual Send)  │  │  (Real-time)    │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                   │
│           └────────────────────┴────────────────────┘                   │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │              API GATEWAY (Rate Limiting)                   │        │
│  │   • 100 req/min por número                                 │        │
│  │   • Circuit breaker para Meta API                          │        │
│  │   • Auth por bot_id (X-Bot-ID header)                      │        │
│  └──────────────────────────┬─────────────────────────────────┘        │
│                             │                                           │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────────────┐
│                             ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                    EVENT BUS (Redis)                         │      │
│  │                                                              │      │
│  │   Channels:                                                  │      │
│  │   • bot:{bot_id}:orders:new                                 │      │
│  │   • bot:{bot_id}:orders:status_changed                      │      │
│  │   • bot:{bot_id}:messages:incoming                          │      │
│  │   • bot:{bot_id}:notifications:high_priority                │      │
│  │                                                              │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                             │                                           │
│                             ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │                 MESSAGE ROUTER                               │        │
│  │                                                              │        │
│  │   Rules:                                                     │        │
│  │   1. Route by bot_id (mandatory)                            │        │
│  │   2. Priority queue for urgent notifications                │        │
│  │   3. Dead letter queue for failed messages                  │        │
│  │   4. Deduplication layer (Redis SET)                        │        │
│  │                                                              │        │
│  └──────────────────────────────────────────────────────────────┘        │
│                             │                                           │
│             ┌───────────────┼───────────────┐                           │
│             │               │               │                           │
│             ▼               ▼               ▼                           │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐              │
│  │  HIGH PRIORITY │ │    STANDARD    │ │  BULK/RETRY    │              │
│  │     QUEUE      │ │     QUEUE      │ │     QUEUE      │              │
│  │   (BullMQ)     │ │   (BullMQ)     │ │   (BullMQ)     │              │
│  │                │ │                │ │                │              │
│  │ • Confirmación │ │ • Status       │ │ • Retry failed │              │
│  │   inmediata    │ │   updates      │ │ • Broadcasts   │              │
│  │ • Alertas      │ │ • Mensajes     │ │ • Campaigns    │              │
│  │   críticas     │ │   cliente      │ │                │              │
│  └───────┬────────┘ └───────┬────────┘ └───────┬────────┘              │
│          │                    │                │                       │
└──────────┼────────────────────┼────────────────┼───────────────────────┘
           │                    │                │
┌──────────┼────────────────────┼────────────────┼───────────────────────┐
│          ▼                    ▼                ▼                       │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │              WORKER POOL (Node.js Cluster)                   │      │
│  │                                                              │      │
│  │   Worker Types:                                              │      │
│  │   ├─ NotificationWorker (8 instances)                        │      │
│  │   │  └─ Procesa envío de mensajes WhatsApp                  │      │
│  │   ├─ OrderProcessorWorker (4 instances)                      │      │
│  │   │  └─ Procesa cambios de estado de órdenes                │      │
│  │   ├─ WebhookWorker (2 instances)                            │      │
│  │   │  └─ Procesa webhooks entrantes de Meta                  │      │
│  │   └─ SchedulerWorker (1 instance)                           │      │
│  │      └─ Retry fallidos, limpieza de cache                  │      │
│  │                                                              │      │
│  │   Features:                                                  │      │
│  │   • Cada worker procesa solo su bot asignado                │      │
│  │   • Graceful shutdown con completion de jobs               │      │
│  │   • Stalled job recovery                                    │      │
│  └──────────────────────────┬──────────────────────────────────┘      │
│                             │                                           │
│                             ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │              CIRCUIT BREAKER LAYER                           │       │
│  │                                                              │       │
│  │   WhatsApp API (Meta)        Fallback Strategies             │       │
│  │   ├─ Circuit CLOSED  ──────► Enviar normal                  │       │
│  │   ├─ Circuit HALF_OPEN ────► Testear con 1 msg              │       │
│  │   └─ Circuit OPEN ────────► Queuear + Retry luego         │       │
│  │                                                              │       │
│  └──────────────────────────────────────────────────────────────┘       │
│                             │                                           │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────────────┐
│                             ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                    PERSISTENCE LAYER                         │      │
│  │                                                              │      │
│  │   Redis Cluster:                                             │      │
│  │   ├─ Deduplication Store (TTL 24h)                          │      │
│  │   ├─ Rate Limiting Counters (TTL 1m)                        │      │
│  │   ├─ Session State (TTL 2h)                               │      │
│  │   └─ Metrics & Analytics (TTL 30d)                          │      │
│  │                                                              │      │
│  │   PostgreSQL (Supabase):                                     │      │
│  │   ├─ notification_logs (particionado por mes)               │      │
│  │   ├─ notification_queue (estado de jobs)                  │      │
│  │   ├─ bot_metrics (rendimiento por bot)                    │      │
│  │   └─ failed_notifications (análisis de errores)           │      │
│  │                                                              │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 COMPONENTES CLAVE

### 1. TENANT ISOLATION SYSTEM

Cada bot opera en un "namespace" completamente aislado:

```typescript
// BotContext.ts - Aislamiento garantizado
export class BotContext {
  readonly botId: string;
  readonly phoneNumberId: string;
  readonly catalogSlug: string;
  readonly redisPrefix: string;
  readonly queuePrefix: string;
  
  constructor(config: BotConfig) {
    this.botId = config.botId;
    this.phoneNumberId = config.phoneNumberId;
    this.catalogSlug = config.catalogSlug;
    this.redisPrefix = `bot:${this.botId}`;
    this.queuePrefix = `queue:${this.botId}`;
  }
  
  // Todas las operaciones de Redis incluyen el prefix
  getRedisKey(key: string): string {
    return `${this.redisPrefix}:${key}`;
  }
  
  // Todas las colas son independientes por bot
  getQueueName(queueType: string): string {
    return `${this.queuePrefix}:${queueType}`;
  }
}
```

**Beneficios:**
- ✅ Bots no comparten estado
- ✅ Un bot lento no afecta a otros
- ✅ Métricas separadas
- ✅ Rate limiting independiente
- ✅ Fácil escalar un bot específico

---

### 2. MESSAGE DEDUPLICATION SYSTEM

Sistema de deduplicación distribuido con Redis:

```typescript
// DistributedDeduplication.ts
export class DistributedDeduplication {
  private redis: Redis;
  
  async isDuplicate(
    botId: string, 
    messageId: string, 
    ttlSeconds: number = 3600
  ): Promise<boolean> {
    const key = `bot:${botId}:dedup:${messageId}`;
    
    // SET NX (Not Exists) + EX (Expire)
    const result = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    
    // result === null significa que ya existía (duplicado)
    return result === null;
  }
  
  // Bloom filter para alta eficiencia espacial (millones de IDs)
  async isDuplicateBloom(
    botId: string, 
    messageId: string
  ): Promise<boolean> {
    const key = `bot:${botId}:bloom:messages`;
    
    // Redis Bloom Filter (RedisBloom module)
    const exists = await this.redis.bf.exists(key, messageId);
    
    if (!exists) {
      await this.redis.bf.add(key, messageId);
      return false; // No era duplicado
    }
    
    return true; // Probable duplicado
  }
}
```

**Características:**
- ✅ Deduplicación distribuida (funciona con N instancias)
- ✅ TTL automático (libera memoria)
- ✅ Bloom filter opcional para escala masiva
- ✅ Aislamiento por bot

---

### 3. PRIORITY QUEUE SYSTEM

Tres niveles de prioridad para manejo inteligente:

```typescript
// QueuePriority.ts
export enum QueuePriority {
  CRITICAL = 1,  // Confirmación de pedido, alertas
  HIGH = 2,      // Status updates
  NORMAL = 3,    // Mensajes regulares
  LOW = 4,       // Broadcasts, campañas
  BULK = 5       // Retry de fallidos
}

// Cada bot tiene 5 colas independientes
const queues = {
  critical: new Queue(`bot:${botId}:critical`),
  high: new Queue(`bot:${botId}:high`),
  normal: new Queue(`bot:${botId}:normal`),
  low: new Queue(`bot:${botId}:low`),
  bulk: new Queue(`bot:${botId}:bulk`)
};
```

**Reglas de procesamiento:**
1. Siempre procesar `critical` antes que `high`
2. Rate limiting por prioridad:
   - Critical: Sin límite
   - High: 50 msg/min
   - Normal: 20 msg/min
   - Low: 10 msg/min
   - Bulk: 5 msg/min

---

### 4. CIRCUIT BREAKER PATTERN

Protección contra fallos en cascada de la API de Meta:

```typescript
// CircuitBreaker.ts
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: number = 0;
  
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RESET_TIMEOUT_MS = 60000; // 1 minuto
  
  async execute<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.RESET_TIMEOUT_MS) {
        this.state = 'HALF_OPEN';
      } else {
        return fallback();
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.FAILURE_THRESHOLD) {
      this.state = 'OPEN';
      console.error('Circuit BREAKER OPEN - API WhatsApp no disponible');
    }
  }
  
  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
}
```

---

### 5. RATE LIMITING DISTRIBUIDO

Rate limiting por bot y por número de cliente:

```typescript
// DistributedRateLimiter.ts
export class DistributedRateLimiter {
  async canSendMessage(
    botId: string,
    phoneNumber: string
  ): Promise<boolean> {
    const botKey = `bot:${botId}:ratelimit:global`;
    const phoneKey = `bot:${botId}:ratelimit:phone:${phoneNumber}`;
    
    // Sliding window: 100 msg/min por bot
    const botCount = await this.redis.incr(botKey);
    if (botCount === 1) {
      await this.redis.expire(botKey, 60);
    }
    
    // Sliding window: 5 msg/min por número
    const phoneCount = await this.redis.incr(phoneKey);
    if (phoneCount === 1) {
      await this.redis.expire(phoneKey, 60);
    }
    
    return botCount <= 100 && phoneCount <= 5;
  }
}
```

---

## 📦 IMPLEMENTACIÓN PASO A PASO

### FASE 1: Infraestructura Base (Días 1-2)

#### 1.1 Setup Redis Cluster
```yaml
# docker-compose.redis.yml
version: '3.8'
services:
  redis-master-1:
    image: redis:7-alpine
    container_name: redis-master-1
    ports:
      - "6379:6379"
    volumes:
      - redis-master-1-data:/data
    command: >
      redis-server 
      --appendonly yes 
      --maxmemory 512mb 
      --maxmemory-policy allkeys-lru
      --requirepass ${REDIS_PASSWORD}
    networks:
      - notification-network

  redis-replica-1:
    image: redis:7-alpine
    container_name: redis-replica-1
    ports:
      - "6380:6379"
    command: >
      redis-server 
      --appendonly yes 
      --slaveof redis-master-1 6379
      --masterauth ${REDIS_PASSWORD}
    networks:
      - notification-network

volumes:
  redis-master-1-data:

networks:
  notification-network:
    driver: bridge
```

#### 1.2 Estructura de Directorios
```
whatsapp-server/src/
├── infrastructure/
│   ├── redis/
│   │   ├── RedisCluster.ts
│   │   └── RedisConfig.ts
│   ├── queue/
│   │   ├── BullMQConfig.ts
│   │   ├── QueueManager.ts
│   │   └── WorkerPool.ts
│   └── circuit-breaker/
│       └── CircuitBreaker.ts
├── services/notifications/
│   ├── NotificationService.ts
│   ├── NotificationRouter.ts
│   ├── DistributedDeduplication.ts
│   └── DistributedRateLimiter.ts
├── workers/
│   ├── NotificationWorker.ts
│   ├── OrderProcessorWorker.ts
│   ├── WebhookWorker.ts
│   └── SchedulerWorker.ts
├── context/
│   └── BotContext.ts
└── api/
    └── routes/
        └── notifications.routes.ts
```

---

### FASE 2: Implementación Core (Días 3-5)

#### 2.1 BotContext - Aislamiento
```typescript
// src/context/BotContext.ts
import { Redis } from 'ioredis';

export interface BotConfig {
  botId: string;
  phoneNumberId: string;
  catalogSlug: string;
  accessToken: string;
  maxMessagesPerMinute: number;
}

export class BotContext {
  readonly config: BotConfig;
  readonly redis: Redis;
  
  constructor(config: BotConfig, redis: Redis) {
    this.config = config;
    this.redis = redis;
  }
  
  get redisPrefix(): string {
    return `bot:${this.config.botId}`;
  }
  
  get queuePrefix(): string {
    return `queue:${this.config.botId}`;
  }
  
  key(...parts: string[]): string {
    return [this.redisPrefix, ...parts].join(':');
  }
  
  queueName(type: string): string {
    return `${this.queuePrefix}:${type}`;
  }
}
```

#### 2.2 DistributedDeduplication
```typescript
// src/services/notifications/DistributedDeduplication.ts
import { Redis } from 'ioredis';
import { BotContext } from '../../context/BotContext';

export class DistributedDeduplication {
  private redis: Redis;
  private defaultTtl: number;
  
  constructor(redis: Redis, defaultTtl: number = 3600) {
    this.redis = redis;
    this.defaultTtl = defaultTtl;
  }
  
  /**
   * Verifica si un mensaje ya fue procesado
   * @returns true si es duplicado, false si es nuevo
   */
  async isDuplicate(
    context: BotContext,
    messageId: string,
    ttlSeconds?: number
  ): Promise<boolean> {
    const key = context.key('dedup', messageId);
    const ttl = ttlSeconds || this.defaultTtl;
    
    try {
      // SET NX (Not Exists) + EX (Expire) - Operación atómica
      const result = await this.redis.set(key, '1', 'EX', ttl, 'NX');
      
      // Si result es null, la key ya existía (es duplicado)
      return result === null;
    } catch (error) {
      // En caso de error de Redis, asumir NO duplicado (fail open)
      console.error('[Deduplication] Redis error:', error);
      return false;
    }
  }
  
  /**
   * Marca múltiples IDs como procesados (batch operation)
   */
  async markAsProcessed(
    context: BotContext,
    messageIds: string[],
    ttlSeconds?: number
  ): Promise<void> {
    const ttl = ttlSeconds || this.defaultTtl;
    const pipeline = this.redis.pipeline();
    
    for (const messageId of messageIds) {
      const key = context.key('dedup', messageId);
      pipeline.set(key, '1', 'EX', ttl);
    }
    
    await pipeline.exec();
  }
  
  /**
   * Limpia entradas expiradas (llamado por mantenimiento)
   */
  async cleanup(context: BotContext): Promise<number> {
    const pattern = context.key('dedup', '*');
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) return 0;
    
    // TTL ya maneja expiración automática, 
    // esto es solo para estadísticas
    let expiredCount = 0;
    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl <= 0) expiredCount++;
    }
    
    return expiredCount;
  }
}

export const deduplicationService = new DistributedDeduplication(
  global.redisClient
);
```

#### 2.3 QueueManager con BullMQ
```typescript
// src/infrastructure/queue/QueueManager.ts
import { Queue, QueueOptions, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { BotContext } from '../../context/BotContext';

export enum QueuePriority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4,
  BULK = 5
}

export interface NotificationJob {
  id: string;
  botId: string;
  phoneNumber: string;
  message: string;
  type: 'order_confirmation' | 'status_update' | 'arrival' | 'custom';
  metadata?: Record<string, any>;
  retryCount?: number;
  maxRetries?: number;
}

export class QueueManager {
  private redis: Redis;
  private queues: Map<string, Queue> = new Map();
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  /**
   * Obtiene o crea una cola para un bot específico
   */
  getQueue(context: BotContext, priority: QueuePriority): Queue {
    const queueName = this.getQueueName(context, priority);
    
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: this.redis,
        defaultJobOptions: {
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      });
      
      this.queues.set(queueName, queue);
    }
    
    return this.queues.get(queueName)!;
  }
  
  /**
   * Agrega un trabajo a la cola con deduplicación
   */
  async enqueue(
    context: BotContext,
    job: NotificationJob,
    priority: QueuePriority = QueuePriority.NORMAL,
    dedupKey?: string
  ): Promise<Job | null> {
    const queue = this.getQueue(context, priority);
    
    // Si hay dedupKey, verificar duplicado
    if (dedupKey) {
      const isDup = await deduplicationService.isDuplicate(context, dedupKey);
      if (isDup) {
        console.log(`[QueueManager] Duplicate job skipped: ${dedupKey}`);
        return null;
      }
    }
    
    const bullJob = await queue.add(job.type, job, {
      priority: priority,
      jobId: job.id
    });
    
    return bullJob;
  }
  
  /**
   * Obtiene estadísticas de todas las colas de un bot
   */
  async getStats(context: BotContext): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    
    for (const priority of Object.values(QueuePriority)) {
      if (typeof priority === 'number') {
        const queue = this.getQueue(context, priority);
        const [waiting, active, completed, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount()
        ]);
        
        stats[QueuePriority[priority]] = {
          waiting,
          active,
          completed,
          failed
        };
      }
    }
    
    return stats;
  }
  
  private getQueueName(context: BotContext, priority: QueuePriority): string {
    const priorityName = QueuePriority[priority].toLowerCase();
    return context.queueName(priorityName);
  }
}

// Singleton
export const queueManager = new QueueManager(global.redisClient);
```

#### 2.4 NotificationWorker
```typescript
// src/workers/NotificationWorker.ts
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { BotContext, BotConfig } from '../context/BotContext';
import { OfficialWhatsAppClient } from '../infrastructure/whatsapp/OfficialWhatsAppClient';
import { CircuitBreaker } from '../infrastructure/circuit-breaker/CircuitBreaker';
import { NotificationJob } from '../infrastructure/queue/QueueManager';
import { DistributedRateLimiter } from '../services/notifications/DistributedRateLimiter';

export class NotificationWorker {
  private worker: Worker;
  private context: BotContext;
  private whatsappClient: OfficialWhatsAppClient;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: DistributedRateLimiter;
  
  constructor(context: BotContext) {
    this.context = context;
    this.whatsappClient = new OfficialWhatsAppClient(context.config);
    this.circuitBreaker = new CircuitBreaker();
    this.rateLimiter = new DistributedRateLimiter();
    
    this.worker = new Worker(
      context.queueName('*'), // Escucha todas las colas del bot
      this.processJob.bind(this),
      {
        connection: context.redis,
        concurrency: 5, // Procesa 5 jobs en paralelo
        limiter: {
          max: 100, // Max 100 jobs por minuto
          duration: 60000
        }
      }
    );
    
    this.setupEventHandlers();
  }
  
  private async processJob(job: Job<NotificationJob>): Promise<any> {
    const { phoneNumber, message, type, retryCount = 0, maxRetries = 3 } = job.data;
    
    console.log(`[NotificationWorker] Processing job ${job.id} for ${phoneNumber}`);
    
    // 1. Rate limiting check
    const canSend = await this.rateLimiter.canSendMessage(
      this.context.config.botId,
      phoneNumber
    );
    
    if (!canSend) {
      throw new Error('Rate limit exceeded');
    }
    
    // 2. Circuit breaker protection
    return this.circuitBreaker.execute(
      async () => {
        // 3. Send message via WhatsApp API
        await this.whatsappClient.sendMessage(phoneNumber, { text: message });
        
        // 4. Log success
        await this.logNotification(job.data, 'success');
        
        return { success: true, timestamp: new Date().toISOString() };
      },
      async () => {
        // Fallback: Queue for retry later
        if (retryCount < maxRetries) {
          await this.scheduleRetry(job.data);
        } else {
          await this.logNotification(job.data, 'failed');
        }
        
        return { success: false, fallback: true };
      }
    );
  }
  
  private async scheduleRetry(job: NotificationJob): Promise<void> {
    const retryDelay = Math.pow(2, job.retryCount || 0) * 60000; // Exponential backoff
    
    // Agregar a cola de retry con delay
    await queueManager.enqueue(
      this.context,
      {
        ...job,
        retryCount: (job.retryCount || 0) + 1
      },
      QueuePriority.BULK,
      `${job.id}:retry:${job.retryCount}`
    );
  }
  
  private async logNotification(
    job: NotificationJob,
    status: 'success' | 'failed'
  ): Promise<void> {
    await supabase.from('notification_logs').insert({
      bot_id: job.botId,
      phone_number: job.phoneNumber,
      message_type: job.type,
      status,
      sent_at: new Date().toISOString(),
      metadata: job.metadata
    });
  }
  
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`[NotificationWorker] Job ${job.id} completed`);
    });
    
    this.worker.on('failed', (job, err) => {
      console.error(`[NotificationWorker] Job ${job?.id} failed:`, err);
    });
  }
  
  async close(): Promise<void> {
    await this.worker.close();
  }
}
```

---

### FASE 3: Integración con el Sistema Actual (Días 6-7)

#### 3.1 Nuevo OrderNotificationListener
```typescript
// src/services/notifications/OrderNotificationListenerV2.ts
import { supabase } from '../../config/database';
import { queueManager, QueuePriority } from '../../infrastructure/queue/QueueManager';
import { deduplicationService } from './DistributedDeduplication';
import { BotRegistry } from '../../context/BotRegistry';

export class OrderNotificationListenerV2 {
  private static instance: OrderNotificationListenerV2;
  private realtimeChannels: Map<string, any> = new Map();
  
  private constructor() {}
  
  static getInstance(): OrderNotificationListenerV2 {
    if (!this.instance) {
      this.instance = new OrderNotificationListenerV2();
    }
    return this.instance;
  }
  
  /**
   * Inicia listeners para todos los bots registrados
   */
  start(): void {
    const bots = BotRegistry.getAllBots();
    
    for (const bot of bots) {
      this.startListenerForBot(bot);
    }
    
    console.log(`[OrderNotificationListenerV2] Started listeners for ${bots.length} bots`);
  }
  
  private startListenerForBot(bot: BotContext): void {
    // Listener único por bot en la tabla orders
    const channel = supabase
      .channel(`bot:${bot.config.botId}:orders`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `chat_context->>bot_id=eq.${bot.config.phoneNumberId}`
        },
        async (payload) => {
          await this.handleOrderChange(bot, payload);
        }
      )
      .subscribe();
    
    this.realtimeChannels.set(bot.config.botId, channel);
  }
  
  private async handleOrderChange(
    bot: BotContext,
    payload: any
  ): Promise<void> {
    const orderId = payload.new?.id;
    const newStatus = payload.new?.status;
    const oldStatus = payload.old?.status;
    
    // Deduplicación distribuida
    const dedupKey = `order:${orderId}:${newStatus}`;
    const isDup = await deduplicationService.isDuplicate(bot, dedupKey, 300);
    
    if (isDup) {
      console.log(`[OrderNotificationV2] Duplicate event ignored: ${dedupKey}`);
      return;
    }
    
    // Determinar prioridad según el status
    const priority = this.getPriorityForStatus(newStatus);
    
    // Obtener template y datos del cliente
    const { message, phoneNumber } = await this.buildNotification(
      bot,
      payload.new
    );
    
    // Enqueue notification
    await queueManager.enqueue(
      bot,
      {
        id: `notif:${orderId}:${newStatus}`,
        botId: bot.config.botId,
        phoneNumber,
        message,
        type: this.getNotificationType(newStatus),
        metadata: {
          orderId,
          status: newStatus,
          oldStatus
        }
      },
      priority,
      dedupKey
    );
    
    console.log(`[OrderNotificationV2] Notification queued for order ${orderId}`);
  }
  
  private getPriorityForStatus(status: string): QueuePriority {
    switch (status) {
      case 'CONFIRMED':
      case 'PENDING':
        return QueuePriority.CRITICAL;
      case 'IN_PREPARATION':
      case 'OUT_FOR_DELIVERY':
        return QueuePriority.HIGH;
      case 'DELIVERED':
        return QueuePriority.NORMAL;
      default:
        return QueuePriority.LOW;
    }
  }
  
  private getNotificationType(status: string): string {
    const typeMap: Record<string, string> = {
      'CONFIRMED': 'order_confirmation',
      'IN_PREPARATION': 'status_update',
      'OUT_FOR_DELIVERY': 'status_update',
      'DELIVERED': 'status_update',
      'CANCELLED': 'order_cancelled'
    };
    
    return typeMap[status] || 'custom';
  }
  
  private async buildNotification(
    bot: BotContext,
    order: any
  ): Promise<{ message: string; phoneNumber: string }> {
    // Template system con variables
    const templates = await this.loadTemplates(bot);
    const client = order.client;
    
    const template = templates[order.status] || templates['DEFAULT'];
    const message = this.fillTemplate(template, {
      clientName: client?.name || 'Cliente',
      orderId: order.id.slice(0, 8),
      total: order.total_amount,
      status: order.status
    });
    
    return {
      message,
      phoneNumber: order.phone || client?.phone
    };
  }
  
  private fillTemplate(template: string, vars: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return vars[key] !== undefined ? String(vars[key]) : match;
    });
  }
  
  private async loadTemplates(bot: BotContext): Promise<Record<string, string>> {
    const { data } = await supabase
      .from('notification_templates')
      .select('status, template')
      .eq('bot_id', bot.config.botId);
    
    const templates: Record<string, string> = {};
    for (const row of data || []) {
      templates[row.status] = row.template;
    }
    
    return templates;
  }
  
  stop(): void {
    for (const [botId, channel] of this.realtimeChannels) {
      supabase.removeChannel(channel);
      console.log(`[OrderNotificationV2] Stopped listener for bot ${botId}`);
    }
    this.realtimeChannels.clear();
  }
}

export const orderNotificationListenerV2 = OrderNotificationListenerV2.getInstance();
```

---

### FASE 4: Migración y Deployment (Día 8)

#### 4.1 Script de Migración
```typescript
// scripts/migrate-to-v2.ts
import { BotRegistry } from '../src/context/BotRegistry';
import { queueManager } from '../src/infrastructure/queue/QueueManager';
import { supabase } from '../src/config/database';

async function migrateToV2() {
  console.log('🚀 Starting migration to Notification System V2...');
  
  // 1. Verificar Redis
  console.log('1️⃣ Checking Redis connection...');
  await redis.ping();
  console.log('✅ Redis connected');
  
  // 2. Registrar bots desde configuración
  console.log('2️⃣ Registering bots...');
  const bots = [
    {
      botId: 'eldelirio',
      phoneNumberId: process.env.BOT_1_PHONE_ID!,
      catalogSlug: 'eldelirio',
      accessToken: process.env.BOT_1_TOKEN!,
      maxMessagesPerMinute: 100
    },
    {
      botId: 'otrolocal',
      phoneNumberId: process.env.BOT_2_PHONE_ID!,
      catalogSlug: 'otrolocal',
      accessToken: process.env.BOT_2_TOKEN!,
      maxMessagesPerMinute: 100
    }
  ];
  
  for (const bot of bots) {
    BotRegistry.register(bot);
    console.log(`✅ Registered bot: ${bot.botId}`);
  }
  
  // 3. Crear tablas necesarias
  console.log('3️⃣ Creating database tables...');
  await supabase.rpc('create_notification_tables');
  console.log('✅ Tables created');
  
  // 4. Iniciar workers
  console.log('4️⃣ Starting workers...');
  await startWorkers();
  console.log('✅ Workers started');
  
  // 5. Iniciar listeners
  console.log('5️⃣ Starting notification listeners...');
  orderNotificationListenerV2.start();
  console.log('✅ Listeners started');
  
  console.log('🎉 Migration completed successfully!');
}

migrateToV2().catch(console.error);
```

---

## 📊 COMPARACIÓN: Sistema Actual vs Nuevo

| Aspecto | Sistema Actual | Sistema V2 | Mejora |
|---------|---------------|------------|---------|
| **Throughput** | 50 pedidos/hora | 1000+ pedidos/hora | 20x |
| **Aislamiento** | ❌ Ninguno | ✅ Por bot completo | - |
| **Deduplicación** | Memoria local | Redis distribuido | 100% |
| **Rate Limiting** | ❌ Ninguno | ✅ Por bot y cliente | - |
| **Retries** | Manual | Automático con backoff | - |
| **Circuit Breaker** | ❌ No | ✅ Protección API | - |
| **Observability** | Logs básicos | Métricas completas | - |
| **Escalabilidad** | Vertical | Horizontal | Infinita |

---

## 🎯 MÉTRICAS DE ÉXITO

### KPIs Post-Implementación
```yaml
Target Metrics:
  throughput:
    current: "50 orders/hour"
    target: "1000+ orders/hour"
    measurement: "Orders processed in peak hour"
  
  latency:
    current: "3-5 seconds"
    target: "<500ms p95"
    measurement: "Time from event to notification queued"
  
  reliability:
    current: "85%"
    target: "99.9%"
    measurement: "Successful notifications / Total events"
  
  deduplication:
    current: "80% effective"
    target: "99.99% effective"
    measurement: "Duplicate messages sent"
  
  resource_usage:
    cpu: "<70% average"
    memory: "<1GB per bot"
    redis: "<512MB"
```

---

## 🔒 CONSIDERACIONES DE SEGURIDAD

1. **Aislamiento de datos**: Cada bot solo accede a su propio prefix en Redis
2. **Rate limiting**: Previene abuso y bloqueos por API de Meta
3. **Circuit breaker**: Evita cascada de fallos si WhatsApp API cae
4. **Audit logging**: Todas las notificaciones se registran para trazabilidad
5. **Retry con backoff**: Evita sobrecargar la API en caso de fallos temporales

---

## 📁 ARCHIVOS A CREAR/MODIFICAR

### Nuevos Archivos (12)
```
src/
├── context/
│   ├── BotContext.ts
│   └── BotRegistry.ts
├── infrastructure/
│   ├── redis/
│   │   └── RedisCluster.ts
│   ├── queue/
│   │   ├── BullMQConfig.ts
│   │   ├── QueueManager.ts
│   │   └── WorkerPool.ts
│   └── circuit-breaker/
│       └── CircuitBreaker.ts
├── services/notifications/
│   ├── NotificationService.ts
│   ├── NotificationRouter.ts
│   ├── DistributedDeduplication.ts
│   └── DistributedRateLimiter.ts
└── workers/
    ├── NotificationWorker.ts
    ├── OrderProcessorWorker.ts
    ├── WebhookWorker.ts
    └── SchedulerWorker.ts
```

### Archivos a Modificar (4)
```
src/
├── index.ts (inicialización)
├── api/routes/
│   ├── whatsapp.routes.ts (integrar nuevo sender)
│   └── whatsapp.webhooks.ts (deduplicación distribuida)
└── services/
    └── OrderService.ts (guardar bot_id correctamente)
```

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### Semana 1: Fundamentos
- **Día 1-2**: Setup Redis Cluster, estructura de directorios
- **Día 3-4**: Implementar BotContext, DistributedDeduplication
- **Día 5**: Implementar QueueManager con BullMQ
- **Día 6-7**: Implementar NotificationWorker y CircuitBreaker

### Semana 2: Integración
- **Día 8-9**: Nuevo OrderNotificationListenerV2
- **Día 10**: Integración con sistema actual
- **Día 11-12**: Testing y debugging
- **Día 13-14**: Deployment gradual (feature flags)

### Semana 3: Optimización
- **Día 15-16**: Monitoreo y métricas
- **Día 17-18**: Performance tuning
- **Día 19-20**: Documentación y handoff

---

## 💡 RECOMENDACIONES ADICIONALES

### 1. Feature Flags
```typescript
// Usar feature flags para migración gradual
if (FeatureFlags.isEnabled('notification-v2', botId)) {
  await notificationServiceV2.send(phone, message);
} else {
  await notificationServiceV1.send(phone, message);
}
```

### 2. Gradual Rollout
- 10% de tráfico → Nuevo sistema
- Monitorear errores
- 50% → 100%

### 3. Rollback Plan
```bash
# Si hay problemas, rollback inmediato
export NOTIFICATION_SYSTEM=legacy
pm2 restart whatsapp-server
```

---

## 📞 SOPORTE Y MANTENIMIENTO

### Monitoreo Diario
- Revisar colas de retry (no debería haber >100)
- Verificar rate limits (no debe alcanzar 80%)
- Revisar circuit breaker status

### Tareas Semanales
- Limpiar logs antiguos (>30 días)
- Revisar métricas de latencia
- Optimizar templates si es necesario

### Tareas Mensuales
- Análisis de patrones de fallos
- Ajustar rate limits según usage
- Revisar costos de infraestructura

---

**Fin del Diseño**

*Sistema diseñado para escalar a 1000+ pedidos/hora con múltiples bots aislados*
