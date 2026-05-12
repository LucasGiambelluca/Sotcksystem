# StockSystem: Feedback y Roadmap hacia SaaS Multi-Tenant

## Estado Actual del Proyecto

He explorado tu codebase y voy a darte un feedback honesto y directo sobre lo que encontré y las recomendaciones para transformarlo en un SaaS exitoso.

---

## Lo Que Está Bien

Tienes una base sólida:

- **Stack tecnológico moderno**: TypeScript, React, Supabase, Redis - fácil de escalar y mantener
- **Motor de flujos visuales**: Editor de bots con nodos - la base del valor diferencial
- **Integración WhatsApp**: Ya tienes conexión con Meta Cloud API (no solo WhatsApp Web/Evolution API)
- **Múltiples features**: Catálogo, pedidos, rutas, envíos, reportes, cocina, cadetes
- **Código bien estructurado**: Separación clara entre capas (core, infrastructure, api)

---

## Problemas Críticos para SaaS Multi-Tenant

### 1. AISLAMIENTO DE BOTS (El Problema Principal)

**Situación actual**: El sistema es **single-tenant**. Toda la configuración de WhatsApp está en una sola tabla `whatsapp_config` sin隔离:

```sql
-- Esto es lo que hay ahora
create table whatsapp_config (
  meta_cloud_token text,
  meta_phone_number_id text,
  meta_waba_id text,
  -- TODOOO: NO HAY tenant_id!!!
);
```

**Por qué es un problema**: Si tienes 2 restaurantes distintos, ambos compartirían el mismo número de WhatsApp. Los pedidos se mixturarían.

**Solución necesaria**: Implementar multi-tenancy con `tenant_id` en TODAS las tablas:

```sql
-- Estructura recomendada
create table tenants (
  id uuid primary key,
  name text not null,
  subdomain text unique,  -- restaurant1.stocksystem.app
  plan text default 'basic',
  created_at timestamptz default now()
);

create table whatsapp_config (
  id uuid primary key,
  tenant_id uuid references tenants(id),
  meta_phone_number_id text,
  -- cada tenant tiene su propia config de WhatsApp
);

-- Todas las tablas现有的 deben tener tenant_id
create table orders (
  id uuid primary key,
  tenant_id uuid references tenants(id),  -- CRÍTICO
  client_id uuid references clients(id),
  ...
);
```

### 2. Dos Teléfonos en la Misma Cuenta WhatsApp API

**Respuesta directa**: **SÍ, es posible** pero con condiciones:

| Escenario |¿Funciona?| Notas |
|----------|---------|-------|
| Mismo número, múltiples bots | ❌ NO | Un número = un Phone ID |
| Mismos número, misma cuenta Business | ⚠️ PARCIAL | Se puede, pero se mezclan conversaciones |
| Distintos números, misma cuenta Business | ✅ SÍ | Cada número es un "Phone Number ID" separado |
| Distintas cuentas Business | ✅ SÍ | Totalmente aislado |

**Cómo funciona en Meta Cloud API**:

```
Cuenta Business Meta
  └── WABA (WhatsApp Business Account)
       ├── Phone Number 1 → Phone ID A → Bot Restaurant A
       ├── Phone Number 2 → Phone ID B → Bot Restaurant B
       └── Phone Number 3 → Phone ID C → Bot Restaurant C
```

Cada `phone_number_id` es independiente. Puedes tener **hasta 10 números** por cuenta Business (en planes gratis y de pago).

**Para tu SaaS**: La estrategia correcta es:

1. **Un número por tenant** (recomendado para isolation total)
2. **Misma cuenta Business multi-número** (si quieres ofrecer el servicio gestionado)
3. **Cada tenant con su propia cuenta Business** (si quieres ofrecer bring-your-own-number)

### 3. Aislamiento de Datos Entre tenants

**Lo que necesitas cambiar**:

```typescript
// ANTES ( Problemático)
const { data } = await supabase
  .from('orders')
  .select('*');

// DESPUÉS (Con tenant_id)
const { data: { tenant_id } } = useAuth(); // Obtener tenant del contexto

const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('tenant_id', tenant_id);  // FILTER OBLIGATORIO
```

**Importante**: Crear una función helper para enforces RLS (Row Level Security):

```sql
-- RLS policy
CREATE POLICY "tenant_isolation_orders" ON orders
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

---

## Precauciones y Riesgos

### 1. Rate Limits de WhatsApp API

| Límite | Free | Business |
|-------|------|----------|
| Mensajes entrantes | Ilimitados | Ilimitados |
| Mensajes salientes | 1,000/mes (prueba) | 250,000/día (inicial) |
| Plantillas (notifications) | 1,000/mes | Hasta 10 |

**Qué hacer**:

- Implementar cola de mensajes (Redis/BullMQ) para controlar rate
- Cachear respuestas frecuentes
- Usar webhooks en paralelo, no secuencial

### 2. Tiempo de Vida de Credenciales

```
Problema real: Los tokens de WhatsApp expiran cada ~23 horas
```

Tu código ya tiene `TokenRefreshJob` (¡bien!), pero para multi-tenant necesitas:

```typescript
class TokenRefreshJob {
  async refreshPerTenant(tenantId: string) {
    // Refrescar token específico de cada tenant
    // Scheduling individual por tenant
  }
}
```

### 3. Conexión WhatsApp - Webhooks

**Peligro actual**: Un solo endpoint de webhook para todas las cuentas.

```typescript
// ENTONCES: webhook genérico (riesgo si no aíslas)
app.post('/webhook/whatsapp', async (req, res) => {
  const { phone_number_id } = req.body; // Llega cualquier número
  // ¿Cómo saber a qué tenant pertenece?
});

// SOLUCIÓN: Subdomain-based routing
app.post('/webhooks/:subdomain', async (req, res) => {
  const { subdomain } = req.params;
  const tenant = await getTenantBySubdomain(subdomain);
  // Aislado correctamente
});
```

### 4. Gestión de Sesiones y Estado

**Problema**: Redis no tiene namespacing actual.

```typescript
// ANTES
redis.set(sessionId, JSON.stringify(session));

// DESPUÉS (multi-tenant)
redis.set(`${tenantId}:${sessionId}`, JSON.stringify(session));
```

---

## Roadmap para Convertirlo en SaaS

### Fase 1: Fundamentos (Semanas 1-2) ✅

- [ ] Agregar tabla `tenants` con schema básico
- [ ] Migrar `whatsapp_config` para soportar multi-tenant
- [ ] Agregar `tenant_id` a todas las tablas de negocio
- [ ] Implementar middleware de aislamiento en API
- [ ] Configurar RLS policies por tenant

### Fase 2: Aislamiento de Bots (Semanas 3-4) 🔄

- [ ] Un `phone_number_id` por tenant
- [ ] Routing de webhooks por subdomain/tenant
- [ ] Colas de mensajes aisladas por tenant
- [ ] Sistema de renovación de tokens por tenant

### Fase 3: Self-Service (Semanas 5-8)

- [ ] Registro público de tenants (signup flow)
- [ ] Onboarding guid para conectar WhatsApp
- [ ] Dashboard de configuración por tenant
- [ ] Planes y límites (free, basic, pro)
- [ ] Facturación básica (stripe integration)

### Fase 4: Escalabilidad (Semanas 9-12)

- [ ] Cacheo por tenant (Redis namespaced)
- [ ] Métricas y analytics por tenant
- [ ] Webhooks configurables por tenant
- [ ] API Keys por tenant (para integraciones)
- [ ] White-label /Custom domains

---

## Arquitectura Recomendada para SaaS Multi-Tenant

```
┌─────────────────────────────────────────────────────────┐
│                    stock-system.app                       │
├─────────────────────────────────────────────────────────┤
│                                                             │
│  restaurant1.stock-system.app    restaurant2.stock-system.app    │
│  │                                  │                      │
│  └── WhatsApp: +54 9 221           └── WhatsApp: +54 9 222  │
│      Phone ID: 123456                   Phone ID: 789012       │
│                                                             │
├─────────────────────────────────────────────────────────┤
│                    Shared Infrastructure                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │   DNS   │  │ Supabase │  │  Redis  │  │  Node    │    │
│  │Route53 │  │ (Shared)│  │(Namesp.)│  │  API    │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
│                                                             │
│  PostgreSQL: diferentes schemas o databases             │
│  - tenant_1.restaurants                                  │
│  - tenant_2.restaurants                                 │
│                                                             │
└─────────────────────────────────────────────────────────┘
```

---

## Recomendación Final: start simple

Para tu objetivo de "rápido y fácil de usar", te sugiero:

1. **No intentes soportarlo TODO desde el principio**: Begins con 1-2 tenants piloto
2. **Usa PostgreSQL schema por tenant** (más simple que RLS initially):
   ```sql
   CREATE SCHEMA tenant_001;
   CREATE SCHEMA tenant_002;
   ```
3. **Un solo WhatsApp por cuenta de Paid** hasta que validen el modelo de negocio
4. **Considera el modelo "Bring Your Own Phone"**: El cliente trae su propio número de WhatsApp Business (más simple de operar)

---

## Resumen Ejecutivo

| Aspecto | Estado Actual | Acción Requerida |
|---------|--------------|-----------------|
| Multi-tenancy | ❌ No existe | Agregar tenant_id everywhere |
| Aislamiento de bots | ❌ Shared | Un phone_number_id por tenant |
| Dos números en misma cuenta | ✅ Soportado por Meta | Limitado por isolation |
| Rate limiting per tenant | ⚠️ Básico | Implementar cola por tenant |
| Registro self-service | ❌ No existe | Agregar signup flow |

**La buena noticia**: Tu código base es sólido. El trabajo principal es de migración de datos, no de reescribir todo.

---

¿Te gustaría que profundice en alguno de estos puntos o que te ayude a planificar la migración específica de alguna tabla?