import { supabase } from '../config/database';

async function improveFlow() {
    console.log('🚀 Mejorando el flujo de validación de ubicación...');

    const { data: flows } = await supabase.from('flows').select('*').eq('name', 'Tomar Pedido').limit(1);
    if (!flows || flows.length === 0) return console.error('❌ Flow not found');

    const flow = flows[0];
    const nodes = [...flow.nodes];
    let edges = [...flow.edges];

    // 1. Crear nodo de Mensaje de Error Amigable
    const failMsgId = 'n_location_fail_msg';
    if (!nodes.find(n => n.id === failMsgId)) {
        nodes.push({
            id: failMsgId,
            type: 'pollNode',
            position: { x: 500, y: 600 },
            data: { 
                question: "❌ Lo sentimos, no realizamos envíos a esa ubicación por razones de seguridad o distancia.\n\n¿Qué preferís hacer?",
                options: ["📍 Intentar con otra dirección", "🏠 Retirar en el local"],
                variable: "retry_option"
            }
        });
    }

    // 2. Crear nodo de Condición para la elección
    const failCondId = 'n_location_fail_cond';
    if (!nodes.find(n => n.id === failCondId)) {
        nodes.push({
            id: failCondId,
            type: 'conditionNode',
            position: { x: 500, y: 750 },
            data: { 
                operator: 'equals',
                variable: 'retry_option',
                expectedValue: '1' // "Intentar con otra dirección"
            }
        });
    }

    // --- RE-CONECTAR ---
    // Eliminar conexiones viejas de falla
    edges = edges.filter(e => e.id !== 'e_val_to_retry');

    // a. Si validación falla (ConditionResult: false) -> Ir al mensaje de elección
    if (!edges.find(e => e.id === 'e_val_to_fail_msg')) {
        edges.push({
            id: 'e_val_to_fail_msg',
            source: 'n_location_val',
            target: failMsgId,
            sourceHandle: 'no',
            targetHandle: 'default'
        });
    }

    // b. Mensaje de fallo -> Condición
    if (!edges.find(e => e.id === 'e_fail_msg_to_cond')) {
        edges.push({
            id: 'e_fail_msg_to_cond',
            source: failMsgId,
            target: failCondId,
            sourceHandle: 'default',
            targetHandle: 'default'
        });
    }

    // c. Si elige "Otra dirección" (YES) -> Volver a n_ask_address
    if (!edges.find(e => e.id === 'e_fail_retry_yes')) {
        edges.push({
            id: 'e_fail_retry_yes',
            source: failCondId,
            target: 'n_ask_address',
            sourceHandle: 'yes',
            targetHandle: 'default'
        });
    }

    // d. Si elige "Retirar en local" (NO) -> Ir al Menú
    if (!edges.find(e => e.id === 'e_fail_retry_no')) {
        edges.push({
            id: 'e_fail_retry_no',
            source: failCondId,
            target: 'n_welcome_pedido',
            sourceHandle: 'no',
            targetHandle: 'default'
        });
    }

    const { error } = await supabase
        .from('flows')
        .update({ nodes, edges, updated_at: new Date().toISOString() })
        .eq('id', flow.id);

    if (error) console.error('❌ Error updating flow:', error);
    else console.log('🎉 ¡Flujo mejorado! Ahora ofrece Retiro en Local si falla la ubicación.');
}

improveFlow();
