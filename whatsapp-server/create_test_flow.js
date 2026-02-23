
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const FLOW_DATA = {
    name: 'Flujo Compra PDF',
    trigger_word: 'pedir pdf',
    description: 'Flujo de prueba para compra con comprobante PDF',
    is_active: true,
    nodes: [
        {
            id: '1',
            type: 'messageNode',
            data: { text: '¡Hola! Bienvenido a nuestra tienda de prueba. Aquí tienes el menú:' },
            position: { x: 100, y: 100 }
        },
        {
            id: '2',
            type: 'catalogNode',
            data: { 
                variable: 'order_items',
                text: 'Elige tus productos escribiendo cantidad y nombre (ej: 2 hamburguesas)' 
            },
            position: { x: 100, y: 250 }
        },
        {
            id: '3',
            type: 'questionNode',
            data: { 
                question: '¿A qué dirección te lo enviamos? 📍',
                variable: 'direccion'
            },
            position: { x: 100, y: 450 }
        },
        {
            id: '4',
            type: 'createOrderNode',
            data: { },
            position: { x: 100, y: 650 }
        },
        {
            id: '5',
            type: 'documentNode',
            data: { },
            position: { x: 100, y: 800 }
        }
    ],
    edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e3-4', source: '3', target: '4' },
        { id: 'e4-5', source: '4', target: '5' }
    ]
};

async function createFlow() {
    console.log('Creating Flow:', FLOW_DATA.name);
    
    // Check if exists
    const { data: existing } = await supabase
        .from('flows')
        .select('id')
        .eq('trigger_word', FLOW_DATA.trigger_word)
        .single();

    if (existing) {
        console.log('Flow exists, updating...', existing.id);
        const { error } = await supabase
            .from('flows')
            .update(FLOW_DATA)
            .eq('id', existing.id);
            
        if (error) console.error('Error updating:', error);
        else console.log('Flow updated successfully!');
    } else {
        const { error } = await supabase
            .from('flows')
            .insert(FLOW_DATA);
            
        if (error) console.error('Error inserting:', error);
        else console.log('Flow created successfully!');
    }
}

createFlow();
