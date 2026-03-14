# Diagnóstico del Workflow del Bot (WhatsApp Engine)

Este documento detalla cómo el bot procesa mensajes, gestiona sesiones y toma decisiones. Se basa en el análisis del código fuente en `whatsapp-server/src/core/engine` y `executors`.

## 1. Arquitectura de Procesamiento

El flujo de un mensaje sigue este camino:
1. **Entrada**: `FlowEngine.processMessage(phone, text)` encola el mensaje para procesamiento secuencial.
2. **Identificación**: Se busca una sesión activa en la tabla `flow_executions` usando `sessionId` (ej: `1to1:54911...`).
3. **Decisión Inicial**:
   - Si existe sesión: Se procesa el input en el nodo actual (`handleInput`).
   - Si NO existe sesión: Se busca un flujo cuyo `trigger_word` coincida con el texto.
4. **Ejecución**: `executeNodeChain` recorre los nodos hasta encontrar uno que requiera entrada del usuario (`wait_for_input`).
5. **Persistencia**: El estado se guarda en Supabase al final de cada turno.

## 2. Toma de Decisiones y Lógica de Flujos

El bot decide qué camino tomar principalmente a través de dos mecanismos:

### A. Evaluación de Condiciones (`ConditionExecutor.ts`)
Cuando el flujo llega a un nodo de condición, se evalúa una variable comparándola con un valor esperado.

```typescript
// ConditionExecutor.ts L29
if (operator === 'equals') result = (val1 === val2 || isNumericMatch || isLooseMatch);
```

**Problema Identificado**: El "Smart Matching" puede ser demasiado agresivo. Si un usuario dice "10" y hay una opción "1. Pedir", `isNumericMatch` podría fallar o acertar erróneamente dependiendo de cómo se limpie el input.

### B. Muestreo de Encuestas (`PollExecutor.ts` / `FlowEngine.resolvePollVote`)
Para nodos tipo Poll (encuestas nativas de WhatsApp), el bot intenta mapear el hash del voto a una opción.

## 3. Interacción con Tablas de Supabase

| Tabla | Uso |
| :--- | :--- |
| `flows` | Almacena la definición de los flujos (nodos y aristas en formato JSON). |
| `flow_executions` | **Crítica.** Guarda el estado actual de cada conversación (nodo actual, variables, estado). |
| `flow_executions_history` | Archivo de sesiones terminadas o expiradas. |

## 4. Puntos Críticos (Por qué "se pierde el hilo")

Tras analizar el código, he detectado estas causas probables de fallos en la conversación:

### 1. Aislamiento de Variables (Namespacing)
La clase `Session` organiza las variables por `flowId`:
```typescript
// Session.ts L56
setVariable(key: string, value: any, namespace?: string): void {
  const ns = namespace || this.context.metadata.flowId;
  // ...
}
```
**Efecto**: Si saltas de un flujo a otro usando un `flowLinkNode`, las variables capturadas en el primero NO son visibles automáticamente en el segundo (a menos que sean `global`), lo que provoca que las condiciones en el segundo flujo fallen.

### 2. Duplicidad de Sesiones
En `FlowEngine.ts`, si la consulta a la base de datos devuelve más de una sesión activa (lo cual ocurre si no se archivaron correctamente), el sistema toma la última por `updated_at`. Esto puede causar que el bot "salte" entre estados si hay inconsistencias en el guardado.

### 3. Falta de Persistencia en Memoria de Trabajo
El archivo `brain_schema.sql` sugiere una tabla `conversation_brain` con `working_memory`, pero el `FlowEngine` actual parece depender 100% de `flow_executions`. Si estas tablas se desincronizan o si hay latencia en Supabase, el bot pierde el contexto.

## Ejemplos de Código Críticos

### Cómo se avanza al siguiente nodo:
```typescript
// flow.engine.ts L271
const handle = result.conditionResult !== undefined ? String(result.conditionResult) : undefined;
const nextNodeId = this.findNextNodeId(flow, session.currentNodeId, handle);
```

### Cómo se recupera la sesión (Punto de falla común):
```typescript
// flow.engine.ts L62
const query = this.db
    .from('flow_executions')
    .select('*')
    .eq('session_id', sessionId)
    .in('status', ['active', 'waiting_input'])
    .order('updated_at', { ascending: false })
    .limit(1);
```

---

**Siguiente Paso Recomendado**: Implementar un log más detallado de la transición de estados en `interactionLog` para tracear exactamente dónde falla la lógica cuando el usuario interactúa.
