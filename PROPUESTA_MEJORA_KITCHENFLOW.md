# Propuesta Técnica: KitchenFlow (Mejora de Pedidos)

Este documento centraliza el análisis de la propuesta para el nuevo sistema de gestión de pedidos y preparación.

## 🔍 Veredicto Técnico: **APROBADO CON RECOMENDACIONES**

La arquitectura propuesta es de nivel profesional y resuelve los problemas críticos de escalabilidad y trazabilidad que tenía el sistema inicial. El paso de un modelo de "mensajería" a uno de "logística" es el camino correcto.

---

## 🛠️ Análisis de Inconsistencias y Riesgos

### 1. Concurrencia en Stock y Slots (Crítico)
**Problema:** En el código propuesto, la validación de stock se hace *antes* de la transacción (`checkStock`). Esto permite una "condición de carrera" (race condition): dos personas validan stock al mismo tiempo, las dos ven que hay 1 unidad, y ambas confirman el pedido.
**Recomendación:** La reserva de stock debe ser **atómica**.
- **Solución SQL:** Usar un `UPDATE ... WHERE stock >= quantity` y verificar si `rowsAffected > 0`.

### 2. El Campo `order_number SERIAL`
**Problema:** Usar un `SERIAL` puro puede fallar si hay una inserción fallida (la secuencia salta números). Además, no es ideal para ID de cara al cliente si el negocio escala.
**Recomendación:** Está bien para empezar, pero sugiero un prefijo diario (ej: `2405-001`) para que cada día los números sean manejables por el personal de cocina.

### 3. Modelo de "Slots" vs "Tiempo Real"
**Problema:** Los slots fijos de 30 minutos funcionan para catering o pedidos programados. Para un restaurante de "flujo continuo", esto podría frustrar al usuario que quiere su comida "lo antes posible".
**Recomendación:** Agregar un slot especial llamado `ASAP` (As Soon As Possible) que use una lógica de "Tiempo de Espera Estimado" basada en la carga actual de los preparadores.

### 4. Modificadores en JSONB
**Problema:** Guardar modificadores como `JSONB` es flexible, pero hace difícil generar reportes de "cuánto queso doble consumimos este mes".
**Recomendación:** Si el negocio escala, los modificadores deberían estar en una tabla maestra `product_modifiers`. Para esta etapa, el `JSONB` es aceptable.

---

## 🏗️ Estructura Final Sugerida (Ajustada)

### Base de Datos (Delta Sugerido)
A la propuesta de SQL, agrego este trigger para la trazabilidad automática:

```sql
-- Trigger para historial automático de estados
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO order_status_history (order_id, from_status, to_status, changed_via)
        VALUES (NEW.id, OLD.status, NEW.status, 'SYSTEM');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_status_change
AFTER UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION log_order_status_change();
```

### Integración con el Bot (Lógica de Decisión)
Para que el bot sea "inteligente", el `findFlowByTrigger` debería priorizar el estado de la sesión:

| Si el Usuario dice... | Y su Estado es... | Acción del Bot |
| :--- | :--- | :--- |
| "Hola" | Cualquiera | Reinicia flujo / Menú Principal |
| "2 pizzas" | `CAPTURING_ITEMS` | Agregado atómico al carrito |
| "1" (número) | `SELECT_SLOT` | Reserva temporal de slot |
| Cualquier texto | `CAPTURE_ADDRESS` | Guardar dirección y pasar a Pago |

---

## 🚀 Próximos Pasos

1. **Migración de Tablas**: Ejecutar los scripts SQL mejorados en Supabase.
2. **Refactor de `OrderService`**: Implementar la lógica atómica de reserva (Stock + Slot).
3. **Dashboard de Cocina**: Crear la vista de React usando el `KanbanCard` propuesto.
4. **Pruebas de Carga**: Simular 10 pedidos simultáneos para validar la lógica de slots.

¿Deseas que proceda con la creación de las migraciones SQL basadas en este análisis?
