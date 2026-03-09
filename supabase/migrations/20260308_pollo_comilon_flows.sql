
-- 1. ASEGURAR PERMISOS (RLS) PARA QUE EL PANEL VEA LOS FLUJOS
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flows_public_read" ON flows;
CREATE POLICY "flows_public_read" ON flows FOR SELECT USING (true);
DROP POLICY IF EXISTS "flows_admin_all" ON flows;
CREATE POLICY "flows_admin_all" ON flows FOR ALL USING (true) WITH CHECK (true);

-- 2. INSERTAR LOS FLUJOS (Corregido con JSONB real para posición y datos)
DELETE FROM flows WHERE name IN ('Bienvenida Pollo Comilón', 'Consulta de Pedido (Bot)', 'Atención Humana (Bot)');

DO $$
DECLARE
    welcome_id UUID := gen_random_uuid();
    consult_id UUID := gen_random_uuid();
    human_id UUID := gen_random_uuid();
BEGIN
    -- FLUJO ATENCIÓN HUMANA
    INSERT INTO flows (id, name, trigger_word, is_active, nodes, edges)
    VALUES (human_id, 'Atención Humana (Bot)', 'humano', true,
        jsonb_build_array(
            jsonb_build_object('id', 'start', 'type', 'input', 'position', jsonb_build_object('x', 250, 'y', 0), 'data', jsonb_build_object('label', 'Inicio')),
            jsonb_build_object('id', 'node_1', 'type', 'handoverNode', 'position', jsonb_build_object('x', 250, 'y', 150), 'data', jsonb_build_object('message', '🍗 *El Pollo Comilón:* Te estamos transfiriendo con un asesor humano. Por favor, aguarda un momento.'))
        ),
        jsonb_build_array(
            jsonb_build_object('id', 'edge_1', 'source', 'start', 'target', 'node_1', 'animated', true)
        )
    );

    -- FLUJO CONSULTA DE PEDIDO
    INSERT INTO flows (id, name, trigger_word, is_active, nodes, edges)
    VALUES (consult_id, 'Consulta de Pedido (Bot)', 'consultar', true,
        jsonb_build_array(
            jsonb_build_object('id', 'start', 'type', 'input', 'position', jsonb_build_object('x', 250, 'y', 0), 'data', jsonb_build_object('label', 'Inicio')),
            jsonb_build_object('id', 'node_1', 'type', 'questionNode', 'position', jsonb_build_object('x', 250, 'y', 150), 'data', jsonb_build_object('question', '🍗 *El Pollo Comilón:* Por favor, ingresá tu número de orden (solo los números):', 'variable', 'order_number')),
            jsonb_build_object('id', 'node_2', 'type', 'orderStatusNode', 'position', jsonb_build_object('x', 250, 'y', 350), 'data', jsonb_build_object('variable', 'order_number'))
        ),
        jsonb_build_array(
            jsonb_build_object('id', 'edge_1', 'source', 'start', 'target', 'node_1', 'animated', true),
            jsonb_build_object('id', 'edge_2', 'source', 'node_1', 'target', 'node_2', 'animated', true)
        )
    );

    -- FLUJO DE BIENVENIDA
    INSERT INTO flows (id, name, trigger_word, is_active, is_default, nodes, edges)
    VALUES (welcome_id, 'Bienvenida Pollo Comilón', 'hola', true, true,
        jsonb_build_array(
            jsonb_build_object('id', 'start', 'type', 'input', 'position', jsonb_build_object('x', 500, 'y', 0), 'data', jsonb_build_object('label', 'Inicio')),
            jsonb_build_object('id', 'node_welcome', 'type', 'messageNode', 'position', jsonb_build_object('x', 500, 'y', 100), 'data', jsonb_build_object('text', '¡Hola! Bienvenido a *El Pollo Comilón* 🍗🏠.')),
            jsonb_build_object('id', 'node_poll', 'type', 'pollNode', 'position', jsonb_build_object('x', 500, 'y', 250), 'data', jsonb_build_object('question', '¿En qué podemos ayudarte hoy?', 'options', jsonb_build_array('1. Hacer pedido', '2. Consultar pedido', '3. Atención humana'), 'variable', 'user_choice')),
            jsonb_build_object('id', 'node_cond_1', 'type', 'conditionNode', 'position', jsonb_build_object('x', 200, 'y', 500), 'data', jsonb_build_object('variable', 'user_choice', 'expectedValue', '1. Hacer pedido')),
            jsonb_build_object('id', 'node_cond_2', 'type', 'conditionNode', 'position', jsonb_build_object('x', 500, 'y', 500), 'data', jsonb_build_object('variable', 'user_choice', 'expectedValue', '2. Consultar pedido')),
            jsonb_build_object('id', 'node_cond_3', 'type', 'conditionNode', 'position', jsonb_build_object('x', 800, 'y', 500), 'data', jsonb_build_object('variable', 'user_choice', 'expectedValue', '3. Atención humana')),
            jsonb_build_object('id', 'node_link_order', 'type', 'messageNode', 'position', jsonb_build_object('x', 200, 'y', 700), 'data', jsonb_build_object('text', '¡Genial! Escribe *pedir* para ver el catálogo.')),
            jsonb_build_object('id', 'node_link_consult', 'type', 'flowLinkNode', 'position', jsonb_build_object('x', 500, 'y', 700), 'data', jsonb_build_object('flowId', consult_id::text)),
            jsonb_build_object('id', 'node_link_human', 'type', 'flowLinkNode', 'position', jsonb_build_object('x', 800, 'y', 700), 'data', jsonb_build_object('flowId', human_id::text))
        ),
        jsonb_build_array(
            jsonb_build_object('id', 'e1', 'source', 'start', 'target', 'node_welcome', 'animated', true),
            jsonb_build_object('id', 'e2', 'source', 'node_welcome', 'target', 'node_poll', 'animated', true),
            jsonb_build_object('id', 'e3', 'source', 'node_poll', 'target', 'node_cond_1', 'animated', true),
            jsonb_build_object('id', 'e4', 'source', 'node_poll', 'target', 'node_cond_2', 'animated', true),
            jsonb_build_object('id', 'e5', 'source', 'node_poll', 'target', 'node_cond_3', 'animated', true),
            jsonb_build_object('id', 'e6', 'source', 'node_cond_1', 'target', 'node_link_order', 'sourceHandle', 'true', 'animated', true),
            jsonb_build_object('id', 'e7', 'source', 'node_cond_2', 'target', 'node_link_consult', 'sourceHandle', 'true', 'animated', true),
            jsonb_build_object('id', 'e8', 'source', 'node_cond_3', 'target', 'node_link_human', 'sourceHandle', 'true', 'animated', true)
        )
    );
END $$;
