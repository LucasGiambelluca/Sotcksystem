# AI Agent Node

Nodo de Agente IA con los 4 pilares, memoria, orquestación por intent y visualizador tipo n8n.

## Estructura

```
src/
├── types.ts              # Todos los tipos TypeScript
├── memory.ts             # MemoryManager — historial de sesión
├── tools.ts              # Superpoderes: stock, pedidos, horarios, resolveProduct
├── AgentNode.ts          # Pipeline principal (los 4 pilares)
├── AgentNodeVisualizer.tsx  # Componente React + hook useAgentNode
├── App.tsx               # Demo app
└── index.ts              # Exports públicos
```

## Los 4 Pilares

### 1. Captura dinámica (`AgentNode.ts` → `process()`)
Toma `input.transcription ?? input.text` — si hay transcripción del nodo de audio,
la usa automáticamente. Sin configuración extra.

### 2. Superpoderes / Tools (`tools.ts`)
Antes de llamar a la IA carga en paralelo:
- `fetchStock()` → productos disponibles
- `fetchLastOrder(phone)` → último pedido del cliente
- `fetchBusinessHours()` → estado del local

Todo se formatea como texto y se pega al system prompt.

### 3. Formato JSON estricto + fallback (`AgentNode.ts` → `parseAgentResponse()`)
El modelo debe responder solo JSON. Si falla hay 3 intentos de reparación:
1. Parse directo
2. Extracción con regex
3. Reparación de JSON truncado
→ Si todo falla: respuesta FALLBACK predefinida.

### 4. Resolución de productos (`tools.ts` → `findProductWithScore()`)
Usa Jaccard similarity sobre tokens normalizados.
"sanguche de mila" → "Sándwich de Mila Completa" (score: 0.4)

## Uso básico

```tsx
import { useAgentNode, AgentNodeVisualizer } from "./src";

function MyComponent() {
  const { state, sendMessage } = useAgentNode("sk-ant-...");

  const handleSend = async () => {
    const response = await sendMessage({
      text: "quiero 2 empanadas de carne",
      sessionId: "user-123",
      clientPhone: "5491112345678",
    });
    console.log(response);
    // { intent: "ORDER", response: "...", items: [{ name: "Empanada de carne", qty: 2, resolvedId: "p1" }] }
  };

  return <AgentNodeVisualizer state={state} onSendMessage={handleSend} />;
}
```

## Agregar un intent nuevo

1. Agregar el tipo en `types.ts`:
```ts
export type IntentType = "ORDER" | "INFO" | "GREETING" | "CANCEL" | "FALLBACK" | "COMPLAINT";
```

2. Actualizar el system prompt en `AgentNode.ts`

3. Agregar la rama en `AgentNodeVisualizer.tsx`

## Dependencias

- React 18+
- TypeScript 5+
- Sin dependencias externas para el core
