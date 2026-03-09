
-- 1. CREAR EL FLUJO "TOMAR PEDIDO"
DO $$
DECLARE
    order_flow_id UUID := gen_random_uuid();
    welcome_flow_id UUID;
BEGIN
    -- Insertar el nuevo flujo de Toma de Pedidos
    INSERT INTO flows (id, name, trigger_word, is_active, nodes, edges)
    VALUES (order_flow_id, 'Tomar Pedido (Bot)', 'pedir', true,
        jsonb_build_array(
            jsonb_build_object('id', 'start', 'type', 'input', 'position', jsonb_build_object('x', 400, 'y', 0), 'data', jsonb_build_object('label', 'Inicio (pedir)')),
            jsonb_build_object('id', 'node_catalog', 'type', 'catalogNode', 'position', jsonb_build_object('x', 400, 'y', 100), 'data', jsonb_build_object('label', 'Ver Catálogo')),
            jsonb_build_object('id', 'node_summary', 'type', 'orderSummaryNode', 'position', jsonb_build_object('x', 400, 'y', 250), 'data', jsonb_build_object('label', 'Ver Resumen')),
            jsonb_build_object('id', 'node_delivery_poll', 'type', 'pollNode', 'position', jsonb_build_object('x', 400, 'y', 400), 'data', jsonb_build_object('question', '🍗 *El Pollo Comilón:* ¿Cómo querés recibir tu pedido?', 'options', jsonb_build_array('1. Envío a domicilio', '2. Retiro por el local'), 'variable', 'tipo_entrega')),
            jsonb_build_object('id', 'node_is_delivery', 'type', 'conditionNode', 'position', jsonb_build_object('x', 400, 'y', 600), 'data', jsonb_build_object('variable', 'tipo_entrega', 'expectedValue', '1. Envío a domicilio')),
            jsonb_build_object('id', 'node_address', 'type', 'questionNode', 'position', jsonb_build_object('x', 200, 'y', 800), 'data', jsonb_build_object('question', '🏠 Por favor, ingresá tu *dirección completa* (calle y altura):', 'variable', 'direccion')),
            jsonb_build_object('id', 'node_payment_poll', 'type', 'pollNode', 'position', jsonb_build_object('x', 400, 'y', 1000), 'data', jsonb_build_object('question', '💳 ¿Cómo vas a pagar?', 'options', jsonb_build_array('1. Efectivo', '2. Transferencia', '3. Mercado Pago'), 'variable', 'metodo_pago')),
            jsonb_build_object('id', 'node_create_order', 'type', 'createOrderNode', 'position', jsonb_build_object('x', 400, 'y', 1200), 'data', jsonb_build_object('label', 'Confirmar Pedido'))
        ),
        jsonb_build_array(
            jsonb_build_object('id', 'e1', 'source', 'start', 'target', 'node_catalog', 'animated', true),
            jsonb_build_object('id', 'e2', 'source', 'node_catalog', 'target', 'node_summary', 'animated', true),
            jsonb_build_object('id', 'e3', 'source', 'node_summary', 'target', 'node_delivery_poll', 'animated', true),
            jsonb_build_object('id', 'e4', 'source', 'node_delivery_poll', 'target', 'node_is_delivery', 'animated', true),
            jsonb_build_object('id', 'e5', 'source', 'node_is_delivery', 'target', 'node_address', 'sourceHandle', 'true', 'animated', true),
            jsonb_build_object('id', 'e6', 'source', 'node_is_delivery', 'target', 'node_payment_poll', 'sourceHandle', 'false', 'animated', true),
            jsonb_build_object('id', 'e7', 'source', 'node_address', 'target', 'node_payment_poll', 'animated', true),
            jsonb_build_object('id', 'e8', 'source', 'node_payment_poll', 'target', 'node_create_order', 'animated', true)
        )
    );

    -- 2. ACTUALIZAR EL FLUJO DE BIENVENIDA PARA APUNTAR AL NUEVO FLUJO
    -- Buscamos el ID del flujo de Bienvenida actual
    SELECT id INTO welcome_flow_id FROM flows WHERE name = 'Bienvenida Pollo Comilón' LIMIT 1;

    IF welcome_flow_id IS NOT NULL THEN
        -- Actualizamos los nodos para reemplazar el mensaje de "Escribe pedir" por un flowLinkNode real
        UPDATE flows 
        SET nodes = (
            SELECT jsonb_agg(
                CASE 
                    WHEN n->>'id' = 'node_link_order' THEN 
                        jsonb_build_object(
                            'id', 'node_link_order', 
                            'type', 'flowLinkNode', 
                            'position', n->'position', 
                            'data', jsonb_build_object('flowId', order_flow_id::text)
                        )
                    ELSE n 
                END
            )
            FROM jsonb_array_elements_text(nodes) AS n
        )
        WHERE id = welcome_flow_id;
        
        -- Nota: jsonb_array_elements_text devuelve el JSONB como texto, si necesitamos manipularlo como JSONB 
        -- es mejor usar JSONB_AGG con JSONB_ARRAY_ELEMENTS.
        
        UPDATE flows 
        SET nodes = (
            SELECT jsonb_agg(
                CASE 
                    WHEN ele->>'id' = 'node_link_order' THEN 
                        jsonb_build_object(
                            'id', 'node_link_order', 
                            'type', 'flowLinkNode', 
                            'position', ele->'position', 
                            'data', jsonb_build_object('flowId', order_flow_id::text)
                        )
                    ELSE ele 
                END
            )
            FROM jsonb_array_elements(nodes) AS ele
        )
        WHERE id = welcome_flow_id;

    END IF;

    RAISE NOTICE 'Flujo de pedido creado con ID: %', order_flow_id;
END $$;
