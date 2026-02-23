require('dotenv').config();
const { supabase } = require('./src/config/database');

const tablesToClean = [
    'route_orders', 
    'order_items', 
    'order_status_history', 
    'orders', 
    'users', 
    'clients', 
    'delivery_slots', 
    'products', 
    'preparation_queues', 
    'flow_executions', 
    'flows'
];

const menuItems = [
    { name: 'Hamburguesa Clásica', price: 500, stock: 100, category: 'Hamburguesas' },
    { name: 'Hamburguesa Doble', price: 700, stock: 100, category: 'Hamburguesas' },
    { name: 'Pizza Muzzarella', price: 800, stock: 100, category: 'Pizzas' },
    { name: 'Pizza Especial', price: 1000, stock: 100, category: 'Pizzas' },
    { name: 'Papas Fritas', price: 300, stock: 100, category: 'Guarniciones' },
    { name: 'Coca Cola / Sprite', price: 200, stock: 100, category: 'Bebidas' }
];

const mainFlows = [
    {
        name: "Bienvenida (Menú)",
        trigger_word: "hola",
        is_active: true,
        nodes: [
            { id: "start", type: "input", data: { label: "Inicio (Hola)" }, position: { x: 250, y: 0 } },
            { id: "msg_1", type: "messageNode", data: { text: "¡Hola! 👋 Bienvenido a nuestro asistente virtual." }, position: { x: 250, y: 100 } },
            { id: "poll_menu", type: "pollNode", data: { question: "¿Qué te gustaría hacer?", options: ["Hacer Pedido", "Soporte", "Horarios"], variable: "menu_choice" }, position: { x: 250, y: 200 } },
            { id: "cond_menu", type: "conditionNode", data: { variable: "menu_choice", expectedValue: "Soporte" }, position: { x: 250, y: 450 } },
            { id: "msg_pedido", type: "messageNode", data: { text: "Excelente! Para pedir, escribí la palabra 'Pedido'." }, position: { x: 50, y: 600 } },
            { id: "msg_soporte", type: "messageNode", data: { text: "Dale, para soporte escribí 'Ayuda'." }, position: { x: 450, y: 600 } }
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
        trigger_word: "pedido",
        is_active: true,
        nodes: [
            { id: "start", type: "input", data: { label: "Inicio (Pedido)" }, position: { x: 250, y: 0 } },
            { id: "msg_cat", type: "messageNode", data: { text: "¡Genial! Acá tenés nuestro catálogo para que elijas: 👇" }, position: { x: 250, y: 100 } },
            { id: "cat_node", type: "catalogNode", data: {}, position: { x: 250, y: 250 } }
        ],
        edges: [
            { id: "e1", source: "start", target: "msg_cat" },
            { id: "e2", source: "msg_cat", target: "cat_node" }
        ]
    }
];

async function resetAndSeed() {
    console.log('🚀 Starting Full System Reset...');

    // 1. Clean All Tables
    for (const table of tablesToClean) {
        process.stdout.write(`  🧹 Cleaning ${table}... `);
        const { error } = await supabase.from(table).delete().not('id', 'is', null);
        if (error) {
            console.log('❌ Error: ' + error.message);
        } else {
            console.log('✅ OK');
        }
    }

    // 2. Seed Products
    console.log('🌱 Seeding Products...');
    const { error: prodErr } = await supabase.from('products').insert(menuItems);
    if (prodErr) console.error('  ❌ Error seeding products:', prodErr);
    else console.log('  ✅ Products seeded');

    // 3. Seed Flows
    console.log('🌱 Seeding Flows...');
    const { error: flowErr } = await supabase.from('flows').insert(mainFlows);
    if (flowErr) console.error('  ❌ Error seeding flows:', flowErr);
    else console.log('  ✅ Flows seeded');

    // 4. Seed Prep Queue
    console.log('🌱 Seeding Infrastructure...');
    const { data: queue, error: qErr } = await supabase.from('preparation_queues').insert({
        name: 'Cocina Principal',
        max_concurrent: 5
    }).select().single();

    if (qErr) console.error('  ❌ Error seeding queue:', qErr);
    else {
        console.log('  ✅ Queue created');
        // Seed Preparer
        const { error: userErr } = await supabase.from('users').insert({
            name: 'Cocinero Test',
            role: 'PREPARER',
            is_active: true,
            current_status: 'ONLINE',
            assigned_queue_id: queue.id
        });
        if (userErr) console.error('  ❌ Error seeding preparer:', userErr);
        else console.log('  ✅ Preparer created');
    }

    // 5. Seed Delivery Slots (Next 5 hours)
    console.log('🌱 Seeding Delivery Slots...');
    const now = new Date();
    const slots = [];
    for (let i = 0; i < 5; i++) {
        const start = new Date(now);
        start.setHours(now.getHours() + i + 1, 0, 0, 0);
        const end = new Date(start);
        end.setMinutes(start.getMinutes() + 30);

        slots.push({
            date: start.toISOString().split('T')[0],
            time_start: start.toTimeString().split(' ')[0],
            time_end: end.toTimeString().split(' ')[0],
            max_orders: 5,
            is_available: true
        });
    }
    const { error: slotErr } = await supabase.from('delivery_slots').insert(slots);
    if (slotErr) console.error('  ❌ Error seeding slots:', slotErr);
    else console.log('  ✅ Delivery slots created');

    console.log('\n✨ INITIAL CONFIGURATION COMPLETE! ✨');
    console.log('System is ready for testing.');
    process.exit(0);
}

resetAndSeed();
