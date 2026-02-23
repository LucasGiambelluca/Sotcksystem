
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const supportFlow = {
    name: "Soporte Técnico",
    trigger_keyword: "soporte",
    is_active: true,
    nodes: [
        {
            id: "node_start",
            type: "input",
            data: { label: "Inicio (Soporte)" },
            position: { x: 250, y: 0 },
            style: { background: '#22c55e', color: 'white' }
        },
        {
            id: "node_1",
            type: "messageNode",
            data: { text: "¡Hola! Estás en el canal de Soporte Técnico. 🛠️" },
            position: { x: 250, y: 100 }
        },
        {
            id: "node_2",
            type: "pollNode",
            data: { 
                question: "¿En qué podemos ayudarte hoy?",
                options: ["Demora", "Producto en mal estado", "Otro"],
                variable: "motivo_soporte"
            },
            position: { x: 250, y: 200 }
        },
        {
            id: "node_cond_1",
            type: "conditionNode",
            data: {
                variable: "motivo_soporte",
                expectedValue: "Demora"
            },
            position: { x: 250, y: 450 }
        },
        {
            id: "node_demora",
            type: "messageNode",
            data: { text: "Lamentamos la demora. 🕒\n\nPor favor envianos tu número de pedido y un asesor revisará el estado del envío enseguida." },
            position: { x: 50, y: 600 }
        },
        {
            id: "node_otro",
            type: "messageNode",
            data: { text: "Entendido. Por favor describí tu problema brevemente y te contactaremos a la brevedad. 📝" },
            position: { x: 450, y: 600 }
        }
    ],
    edges: [
        { id: "e1", source: "node_start", target: "node_1" },
        { id: "e2", source: "node_1", target: "node_2" },
        { id: "e3", source: "node_2", target: "node_cond_1" },
        // Condition True -> Demora
        { id: "e4", source: "node_cond_1", sourceHandle: "true", target: "node_demora" },
        // Condition False -> Otro (Simplified for demo)
        { id: "e5", source: "node_cond_1", sourceHandle: "false", target: "node_otro" }
    ]
};

async function seed() {
    console.log('🌱 Seeding Support Flow...');
    
    // Check if exists
    const { data: existing } = await supabase.from('bot_flows').select('id').eq('name', supportFlow.name).single();
    
    if (existing) {
        console.log('⚠️ Logic flow already exists, updating...');
        await supabase.from('bot_flows').update(supportFlow).eq('id', existing.id);
    } else {
        await supabase.from('bot_flows').insert(supportFlow);
    }

    console.log('✅ Seed complete!');
}

seed();
