
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const mainFlows = [
    {
        name: "Bienvenida (Menú)",
        trigger_keyword: "hola",
        is_active: true,
        nodes: [
            { id: "start", type: "input", data: { label: "Inicio (Hola)" }, position: { x: 250, y: 0 }, style: { background: '#22c55e', color: 'white' } },
            { id: "msg_1", type: "messageNode", data: { text: "¡Hola! 👋 Bienvenido a nuestro asistente virtual." }, position: { x: 250, y: 100 } },
            { id: "poll_menu", type: "pollNode", data: { question: "¿Qué te gustaría hacer?", options: ["Hacer Pedido", "Soporte", "Horarios"], variable: "menu_choice" }, position: { x: 250, y: 200 } },
            { id: "cond_menu", type: "conditionNode", data: { variable: "menu_choice", expectedValue: "Soporte" }, position: { x: 250, y: 450 } },
            // Logic for jumping between flows isn't implemented yet, but we will seed them independently.
            // For now, this flow just handles the menu.
            // Ideally "Hacer Pedido" would be a keyword trigger for another flow.
            // We'll instruct the user to type "Pedido" if they choose that.
            { id: "msg_pedido", type: "messageNode", data: { text: "Excelente! Para pedir, escribí la palabra 'Pedido' o 'Comprar'." }, position: { x: 50, y: 600 } },
            { id: "msg_soporte", type: "messageNode", data: { text: "Dale, para soporte escribí 'Soporte'." }, position: { x: 450, y: 600 } }

            // Edges logic:
            // Poll -> Condition (Soporte?)
            // True -> msg_soporte
            // False -> Check if Pedido? (Simplifying to msg_pedido for now)
        ],
        edges: [
            { id: "e1", source: "start", target: "msg_1" },
            { id: "e2", source: "msg_1", target: "poll_menu" },
            { id: "e3", source: "poll_menu", target: "cond_menu" },
            { id: "e4", source: "cond_menu", sourceHandle: "true", target: "msg_soporte" },
            { id: "e5", source: "cond_menu", sourceHandle: "false", target: "msg_pedido" }
        ]
    },
    {
        name: "Hacer Pedido",
        trigger_keyword: "pedido",
        is_active: true,
        nodes: [
            { id: "start", type: "input", data: { label: "Inicio (Pedido)" }, position: { x: 250, y: 0 }, style: { background: '#3b82f6', color: 'white' } },
            { id: "q_name", type: "questionNode", data: { question: "¡Genial! Para empezar, ¿cómo te llamás?", variable: "nombre", saveField: "client_name" }, position: { x: 250, y: 100 } },
            { id: "q_addr", type: "questionNode", data: { question: "Perfecto. ¿Cuál es la dirección de entrega?", variable: "direccion", saveField: "client_address" }, position: { x: 250, y: 250 } },
            { id: "msg_cat", type: "messageNode", data: { text: "¡Gracias! Acá tenés nuestro catálogo para que elijas lo que más te guste. 👇" }, position: { x: 250, y: 400 } },
            { id: "cat_node", type: "catalogNode", data: {}, position: { x: 250, y: 550 } }
        ],
        edges: [
            { id: "e1", source: "start", target: "q_name" },
            { id: "e2", source: "q_name", target: "q_addr" },
            { id: "e3", source: "q_addr", target: "msg_cat" },
            { id: "e4", source: "msg_cat", target: "cat_node" }
        ]
    },
    // Support flow is already seeded, but let's re-seed it to be safe
    {
        name: "Info y Horarios",
        trigger_keyword: "info",
        is_active: true,
        nodes: [
            { id: "start", type: "input", data: { label: "Inicio (Info)" }, position: { x: 250, y: 0 }, style: { background: '#a855f7', color: 'white' } },
            { id: "msg_hours", type: "messageNode", data: { text: "🕒 *Nuestros Horarios:*\nLunes a Viernes: 09:00 - 18:00\nSábado: 09:00 - 13:00\n\n📍 *Ubicación:*\nCalle Falsa 123, Bahía Blanca\n\n🚚 *Envíos:*\nHacemos envíos a toda la ciudad en el día." }, position: { x: 250, y: 100 } }
        ],
        edges: [
            { id: "e1", source: "start", target: "msg_hours" }
        ]
    }
];

async function seed() {
    console.log('🌱 Seeding Main Flows...');
    
    for (const flow of mainFlows) {
        // Check if exists
        const { data: existing } = await supabase.from('bot_flows').select('id').eq('name', flow.name).single();
        
        if (existing) {
            console.log(`⚠️ Flow "${flow.name}" already exists, updating...`);
            await supabase.from('bot_flows').update(flow).eq('id', existing.id);
        } else {
            console.log(`✨ Creating Flow "${flow.name}"...`);
            await supabase.from('bot_flows').insert(flow);
        }
    }

    console.log('✅ Seed complete!');
}

seed();
