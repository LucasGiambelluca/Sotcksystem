import { supabase } from './src/config/database';

async function createGenericAgentFlow() {
    const flowId = '6f8c8577-4c7a-4b9e-a89c-0d3a51f2b3e4';
    
    const flowData = {
        id: flowId,
        name: '🤖 Agente de Atención (Propio)',
        trigger_word: '*', // Atrapa todo
        is_active: true,
        nodes: [
            {
                id: 'start',
                type: 'input',
                position: { x: 100, y: 200 },
                data: { label: 'Mensaje Entrante' }
            },
            {
                id: 'agente_cerebro',
                type: 'aiAgentNode',
                position: { x: 400, y: 150 },
                data: {
                    system_prompt: 'Sos un empleado de El Pollo Comilón. Amable y conciso (máximo 4 líneas). Si preguntan por empanadas decí que tenés de Carne, Pollo, JyQ y Humita. Para pedir que digan PEDIDO.',
                    output_variable: 'agente',
                    threshold: 0.7,
                    model: 'gemini-2.0-flash'
                }
            },
            {
                id: 'responder',
                type: 'messageNode',
                position: { x: 800, y: 200 },
                data: { text: '{{agente_response}}' }
            }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'agente_cerebro' },
            { id: 'e2', source: 'agente_cerebro', target: 'responder', sourceHandle: 'consulta' },
            { id: 'e3', source: 'agente_cerebro', target: 'responder', sourceHandle: 'saludo' },
            { id: 'e4', source: 'agente_cerebro', target: 'responder', sourceHandle: 'desconocido' }
        ]
    };

    const { error } = await supabase.from('flows').upsert(flowData);
    
    if (error) {
        console.error('❌ Error creando flujo:', error);
    } else {
        console.log('✅ Flujo "Agente Genérico" creado exitosamente.');
        console.log('Ahora cualquier mensaje que no sea un comando específico será respondido por la IA.');
    }
    process.exit();
}

createGenericAgentFlow();
