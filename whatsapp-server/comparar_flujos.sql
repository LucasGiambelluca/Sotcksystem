-- Consultar todos los flujos para ver cuáles existen y cuántos nodos tienen
SELECT 
    id, 
    name, 
    is_active, 
    jsonb_array_length(nodes) as total_nodos,
    updated_at 
FROM flows 
ORDER BY name;

-- Ver los detalles de los nodos del flujo de pedido
-- (Ejecutar esto para ver si "n_ask_delivery" existe en los flujos)
SELECT 
    name, 
    nodes 
FROM flows 
WHERE name ILIKE '%pedido%' OR name ILIKE '%Tomar Pedido%';
