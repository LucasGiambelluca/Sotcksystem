import { supabase } from '../config/database';

async function updateFlow() {
    console.log('🚀 Iniciando actualización del flujo "Tomar Pedido"...');

    // 1. Obtener el flujo actual
    const { data: flows, error: fetchError } = await supabase
        .from('flows')
        .select('*')
        .eq('name', 'Tomar Pedido')
        .limit(1);

    if (fetchError || !flows || flows.length === 0) {
        console.error('❌ No se encontró el flujo "Tomar Pedido"', fetchError);
        return;
    }

    const flow = flows[0];
    const nodes = [...flow.nodes];
    const edges = [...flow.edges];

    // 2. Definir el nuevo nodo validador
    const validatorNodeId = 'n_location_val';
    const validatorNode = {
        id: validatorNodeId,
        type: 'locationValidatorNode',
        position: { x: 400, y: 450 }, // Posición visual en el editor
        data: { 
            label: 'Validar Ubicación',
            failNodeId: 'n_ask_address' // Re-preguntar si falla
        }
    };

    // Agregar si no existe
    if (!nodes.find(n => n.id === validatorNodeId)) {
        nodes.push(validatorNode);
        console.log('✅ Nodo validador agregado.');
    }

    // 3. Re-mapear Edges
    // El edge original era: n_ask_address -> n_ask_payment (id: e5)
    // Nuevo camino: n_ask_address -> n_location_val -> n_ask_payment
    
    // Eliminar e5
    const filteredEdges = edges.filter(e => e.id !== 'e5');

    // Agregar nuevos edges si no existen
    if (!filteredEdges.find(e => e.id === 'e_val_1')) {
        filteredEdges.push({
            id: 'e_val_1',
            source: 'n_ask_address',
            target: validatorNodeId,
            sourceHandle: 'default',
            targetHandle: 'default'
        });
    }
    
    if (!filteredEdges.find(e => e.id === 'e_val_success')) {
        filteredEdges.push({
            id: 'e_val_success',
            source: validatorNodeId,
            target: 'n_ask_payment',
            sourceHandle: 'yes', // El executor devuelve conditionResult
            targetHandle: 'default'
        });
    }

    if (!filteredEdges.find(e => e.id === 'e_val_fail')) {
        filteredEdges.push({
            id: 'e_val_fail',
            source: validatorNodeId,
            target: 'n_ask_address',
            sourceHandle: 'no',
            targetHandle: 'default'
        });
    }

    // 4. Guardar en DB
    const { error: updateError } = await supabase
        .from('flows')
        .update({ 
            nodes, 
            edges: filteredEdges,
            updated_at: new Date().toISOString()
        })
        .eq('id', flow.id);

    if (updateError) {
        console.error('❌ Error al actualizar el flujo:', updateError);
    } else {
        console.log('🎉 ¡Flujo actualizado con éxito! El bot ahora validará zonas de envío.');
    }
}

updateFlow();
