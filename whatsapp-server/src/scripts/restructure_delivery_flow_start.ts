import { supabase } from '../config/database';

async function restructureFlow() {
    console.log('🚀 Iniciando reestructuración del flujo "Tomar Pedido"...');

    // 1. Obtener el flujo
    const { data: flows, error: fetchError } = await supabase
        .from('flows')
        .select('*')
        .eq('name', 'Tomar Pedido')
        .limit(1);

    if (fetchError || !flows || flows.length === 0) {
        console.error('❌ No se encontró el flujo "Tomar Pedido"');
        return;
    }

    const flow = flows[0];
    const nodes = [...flow.nodes];
    const edges = [...flow.edges];

    // Asegurarse de que el nodo validador existe (por si no se corrió el script anterior)
    const validatorNodeId = 'n_location_val';
    if (!nodes.find(n => n.id === validatorNodeId)) {
        nodes.push({
            id: validatorNodeId,
            type: 'locationValidatorNode',
            position: { x: 500, y: 400 },
            data: { 
                label: 'Validar Ubicación',
                failNodeId: 'n_ask_address' 
            }
        });
    }

    // --- RE-MAPEO DE EDGES ---
    // El objetivo es: start -> n_ask_delivery -> (Si delivery) -> n_ask_address -> n_location_val -> n_welcome_pedido
    
    let newEdges = edges.filter(e => ![
        'e1', // start -> n_welcome_pedido
        'e3', // n_cond_delivery -> n_ask_address
        'e4', // n_cond_delivery -> n_ask_payment (CAMBIO: ahora va al menú)
        'e5', // n_ask_address -> n_ask_payment
        'e_val_1', 'e_val_success', 'e_val_fail' // Edges previos del validador si existían
    ].includes(e.id));

    // 1. Inicio directo a preguntar Delivery/Retiro
    newEdges.push({
        id: 'e_start_to_ask',
        source: 'start',
        target: 'n_ask_delivery',
        sourceHandle: 'default',
        targetHandle: 'default'
    });

    // 2. Si es Delivery (n_cond_delivery YES) -> Preguntar Dirección
    newEdges.push({
        id: 'e_cond_to_address',
        source: 'n_cond_delivery',
        target: 'n_ask_address',
        sourceHandle: 'yes',
        targetHandle: 'default'
    });

    // 3. Dirección -> Validar GPS
    newEdges.push({
        id: 'e_address_to_val',
        source: 'n_ask_address',
        target: validatorNodeId,
        sourceHandle: 'default',
        targetHandle: 'default'
    });

    // 4. Validación EXITOSA -> Mostrar Menú (n_welcome_pedido)
    newEdges.push({
        id: 'e_val_to_menu',
        source: validatorNodeId,
        target: 'n_welcome_pedido',
        sourceHandle: 'yes',
        targetHandle: 'default'
    });

    // 5. Validación FALLIDA -> Re-preguntar Dirección
    newEdges.push({
        id: 'e_val_to_retry',
        source: validatorNodeId,
        target: 'n_ask_address',
        sourceHandle: 'no',
        targetHandle: 'default'
    });

    // 6. Si es Retiro en Local (n_cond_delivery NO) -> Ir directo al Menú
    newEdges.push({
        id: 'e_pickup_to_menu',
        source: 'n_cond_delivery',
        target: 'n_welcome_pedido',
        sourceHandle: 'no',
        targetHandle: 'default'
    });

    // 7. Menú (n_welcome_pedido) -> Preguntar Pago (n_ask_payment)
    // El nodo de bienvenida ahora actúa como el puente al catálogo
    if (!newEdges.find(e => e.source === 'n_welcome_pedido')) {
        newEdges.push({
            id: 'e_menu_to_payment',
            source: 'n_welcome_pedido',
            target: 'n_ask_payment',
            sourceHandle: 'default',
            targetHandle: 'default'
        });
    }

    // Actualizar DB
    const { error: updateError } = await supabase
        .from('flows')
        .update({ 
            nodes, 
            edges: newEdges,
            updated_at: new Date().toISOString()
        })
        .eq('id', flow.id);

    if (updateError) {
        console.error('❌ Error al actualizar el flujo:', updateError);
    } else {
        console.log('🎉 ¡Flujo reestructurado con éxito! Ubicación al inicio activada.');
    }
}

restructureFlow();
