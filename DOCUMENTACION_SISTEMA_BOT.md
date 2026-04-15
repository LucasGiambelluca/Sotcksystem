# 🧠 DOCUMENTACIÓN INTEGRAL: MOTOR DE FLUJOS STOCKSYSTEM (V5.0)

Este documento es la referencia definitiva para la creación, gestión y depuración de flujos en el BotBuilder. Detalla cada nodo, su comportamiento lógico y la estructura técnica del sistema.

---

## 🏗️ 1. Conceptos Fundamentales

### El Motor (FlowEngine)
El `FlowEngine` es un intérprete de grafos que procesa mensajes en tiempo real.
- **Traverse:** El motor recorre los nodos siguiendo las "Edges" (aristas) de forma secuencial.
- **Wait for Input:** Algunos nodos detienen la ejecución hasta que el usuario responde (ej: `questionNode`, `pollNode`, `audioToTextNode`).
- **Contexto:** Todas las variables se guardan en una sesión persistente. Puedes acceder a ellas con `{{nombre_variable}}`.

---

## 📂 2. Diccionario Completo de Nodos

### A. Nodos de Inicio e Intercepción
#### 1. `webhookNode` (Hook / Inicio)
- **Función:** Captura mensajes entrantes que no coinciden con triggers de texto.
- **Inputs:** Datos crudos del mensaje de WhatsApp.
- **Variables Generadas:** `webhook_raw_message`, `webhook_timestamp`.

#### 2. `input` / `start` (Inicio Convencional)
- **Función:** Gatillo basado en palabras clave (Keyword triggers).
- **Configuración:** `keywords` (CSV). Ej: "hola, empezar, menu".

---

### B. Nodos de Inteligencia Artificial (AI Stack)
#### 3. `aiAgentNode` (Agente Cerebro)
- **Función:** Orquestador central con razonamiento natural.
- **Poderes (Tools):** Puede consultar **Stock**, **Pedidos** y **Horarios** si se activan los checkboxes.
- **Variables Generadas:** `{{agent_intent}}` (intención), `{{agent_intent_response}}` (respuesta natural), `{{agent_intent_items}}` (lista de productos extraídos).

#### 4. `bufferMemoryNode` (Pila Memoria)
- **Función:** Carga el historial de la conversación desde Redis para dárselo a la IA.
- **Configuración:** `capacity` (Cantidad de mensajes a recordar).

#### 5. `mediaTypeDetectorNode` (Detector de Media)
- **Función:** Ramifica el flujo según si el usuario mandó un Audio, Texto o Imagen.
- **Handles de salida:** `audio`, `text`, `image`.

#### 6. `audioToTextNode` (Audio → Texto)
- **Función:** Transcribe audio mediante Whisper.
- **Smart Bypass:** Si el audio ya fue transcrito al inicio, avanza automáticamente sin esperar.

---

### C. Nodos de Interacción con el Cliente
#### 7. `messageNode` (Mensaje)
- **Función:** Envía texto plano. Soporta variables: *"Hola {{customer_name}}!"*.

#### 8. `questionNode` (Pregunta)
- **Función:** Envía un texto y guarda la respuesta del usuario en una variable personalizada.

#### 9. `pollNode` (Encuesta / Opciones)
- **Función:** Envía opciones numeradas (1, 2, 3...). 
- **Validación:** No deja avanzar hasta que el usuario elija una opción válida.

---

### D. Nodos de Negocio y Logística
#### 10. `catalogNode` (Catálogo)
- **Función:** Envía la lista de precios actualiza desde la base de datos.
- **Configuración:** `category` (opcional).

#### 11. `stockCheckNode` (Consulta Stock)
- **Función:** Verifica si hay stock disponible de un producto específico.
- **Variable generada:** `{{stock_result}}` (true/false).

#### 12. `orderValidatorNode` (Validar Pedido)
- **Función:** Valida la lista de items del carrito contra el catálogo real. Sugiere productos similares si no hay coincidencia exacta.

#### 13. `createOrderNode` (Crear Pedido)
- **Función:** Persiste el pedido en la base de datos de producción (tabla `orders`).

#### 14. `orderStatusNode` (Consulta Pedido)
- **Función:** Busca el estado de un pedido por teléfono o ID.

#### 15. `locationValidatorNode` (Validar Ubicación)
- **Función:** Verifica si la dirección del usuario está dentro de los radios de entrega configurados.

#### 16. `businessHoursNode` (Horario Atención)
- **Función:** Ramifica el flujo según si el local está abierto (handle `open`) o cerrado (handle `closed`).

---

### E. Nodos de Utilidades y Control de Flujo
#### 17. `flowLinkNode` (Ir a Flujo)
- **Función:** Salta a otro flujo completo sin perder el contexto.

#### 18. `timerNode` (Timer / Espera)
- **Función:** Detiene la ejecución por X segundos/minutos.

#### 19. `threadNode` (Control Bot)
- **Función:** Pausa o reanuda el bot para el usuario actual. Útil para intervención manual.

#### 20. `clearCartNode` (Vaciar Carrito)
- **Función:** Limpia el carrito de compras del usuario.

#### 21. `handoverNode` (Asesor Humano)
- **Función:** Pausa el bot y envía una notificación al dashboard de asesores.

---

## � 3. Especificación Técnica del JSON (Export/Import)

El motor lee un objeto con dos arrays principales: `nodes` y `edges`.

### Ejemplo de Nodo JSON:
```json
{
  "id": "unique_id",
  "type": "aiAgentNode",
  "data": {
    "system_prompt": "Prompt de personalidad",
    "tools": { "tool_stock": true, "tool_orders": true },
    "output_variable": "mi_intencion"
  },
  "position": { "x": 100, "y": 200 }
}
```

### Ejemplo de Edge (Conexión) JSON:
```json
{
  "id": "e1-2",
  "source": "nodo_origen",
  "target": "nodo_destino",
  "sourceHandle": "nombre_del_handle" // ej: 'pedido', 'consulta' o 'audio'
}
```

---

## 🗝️ 4. Variables Globales Reservadas

| Variable | Descripción |
| :--- | :--- |
| `{{phone}}` | Número de teléfono del cliente (con código de país). |
| `{{pushName}}` | Nombre del cliente configurado en su WhatsApp. |
| `{{user_message}}` | El último mensaje de texto recibido. |
| `{{transcripcion}}` | Resultado del último nodo Audio → Texto. |
| `{{last_agent_response}}` | El último texto que el bot envió. |
| `{{cart_total}}` | Suma total del carrito actual si existe. |

---

## � 5. Guía de Depuración (Logs)

- **`[TRAVERSE] Node: X`**: Indica que el bot está procesando el nodo X.
- **`[INPUT] Advancing session...`**: El bot recibió una respuesta y se mueve al siguiente nodo.
- **`[DEBUG-PATH] ⏸️ Waiting for input`**: El flujo se detuvo esperando al usuario.
- **`Error: No executor found`**: Falta registrar un tipo de nodo en el backend.

---
*Fin del documento - Actualizado 13/04/2026*
