const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function createCheckoutFlow() {
    // We already have 'pedir' flow. We'll create 'checkout_catalogo' as a distinct flow 
    // that starts at the summary node.
    
    // First, find the order flow nodes to copy some logic if needed,
    // or just define a new one from scratch.
    
    const flowData = {
        name: 'Checkout Catálogo (Web)',
        trigger_word: 'checkout_catalogo',
        is_active: true,
        nodes: [
            { 
                id: 'start', 
                type: 'input', 
                position: { x: 400, y: 0 }, 
                data: { label: 'Inicio Catálogo' } 
            },
            { 
                id: 'node_summary', 
                type: 'orderSummaryNode', 
                position: { x: 400, y: 150 }, 
                data: { label: 'Resumen' } 
            },
            { 
                id: 'node_delivery', 
                type: 'pollNode', 
                position: { x: 400, y: 300 }, 
                data: { 
                    question: '🍗 *El Pollo Comilón:* ¿Cómo querés recibir tu pedido?', 
                    options: ['1. Envío a domicilio', '2. Retiro por el local'], 
                    variable: 'tipo_entrega' 
                } 
            },
            { 
                id: 'node_is_delivery', 
                type: 'conditionNode', 
                position: { x: 400, y: 500 }, 
                data: { 
                    variable: 'tipo_entrega', 
                    operator: 'contains',
                    expectedValue: 'Envío'
                } 
            },
            { 
                id: 'node_address', 
                type: 'questionNode', 
                position: { x: 200, y: 700 }, 
                data: { 
                    question: '🏠 Por favor, ingresá tu *dirección completa* (calle y altura):', 
                    variable: 'direccion' 
                } 
            },
            { 
                id: 'node_payment', 
                type: 'pollNode', 
                position: { x: 400, y: 900 }, 
                data: { 
                    question: '💳 ¿Cómo vas a pagar?', 
                    options: ['1. Efectivo', '2. Transferencia', '3. Mercado Pago'], 
                    variable: 'metodo_pago' 
                } 
            },
            { 
                id: 'node_create', 
                type: 'createOrderNode', 
                position: { x: 400, y: 1100 }, 
                data: { label: 'Confirmar' } 
            }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'node_summary' },
            { id: 'e2', source: 'node_summary', target: 'node_delivery' },
            { id: 'e3', source: 'node_delivery', target: 'node_is_delivery' },
            { id: 'e4', source: 'node_is_delivery', sourceHandle: 'true', target: 'node_address' },
            { id: 'e5', source: 'node_is_delivery', sourceHandle: 'false', target: 'node_payment' },
            { id: 'e6', source: 'node_address', target: 'node_payment' },
            { id: 'e7', source: 'node_payment', target: 'node_create' }
        ]
    };

    const { data, error } = await supabase.from('flows').insert(flowData).select();
    
    if (error) {
        console.error('Error creating checkout flow:', error);
    } else {
        console.log('Successfully created Checkout Catálogo flow:', data[0].id);
    }
}

createCheckoutFlow();
