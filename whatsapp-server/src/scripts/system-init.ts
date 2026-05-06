/**
 * System Initialization Script
 * Seeds a fresh database with essential data for a new tenant.
 * Usage: npx ts-node src/scripts/index.ts init
 */
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { supabase } from '../config/database';

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

const sampleProducts = [
    { name: 'Producto Demo 1', price: 500, stock: 100, category: 'General' },
    { name: 'Producto Demo 2', price: 700, stock: 100, category: 'General' },
    { name: 'Producto Demo 3', price: 300, stock: 100, category: 'Bebidas' },
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

export async function systemInit(): Promise<void> {
    console.log('🚀 Starting Full System Initialization...\n');

    // 1. Clean All Tables
    for (const table of tablesToClean) {
        process.stdout.write(`  🧹 Cleaning ${table}... `);
        const { error } = await supabase.from(table).delete().not('id', 'is', null);
        console.log(error ? `❌ ${error.message}` : '✅');
    }

    // 2. Seed Products
    console.log('\n🌱 Seeding Products...');
    const { error: prodErr } = await supabase.from('products').insert(sampleProducts);
    console.log(prodErr ? `  ❌ ${prodErr.message}` : '  ✅ Products seeded');

    // 3. Seed Flows
    console.log('🌱 Seeding Flows...');
    const { error: flowErr } = await supabase.from('flows').insert(mainFlows);
    console.log(flowErr ? `  ❌ ${flowErr.message}` : '  ✅ Flows seeded');

    // 4. Seed Prep Queue
    console.log('🌱 Seeding Infrastructure...');
    const { data: queue, error: qErr } = await supabase.from('preparation_queues').insert({
        name: 'Cocina Principal',
        max_concurrent: 5
    }).select().single();

    if (qErr) {
        console.log(`  ❌ ${qErr.message}`);
    } else {
        console.log('  ✅ Queue created');
        const { error: userErr } = await supabase.from('users').insert({
            name: 'Cocinero Test',
            role: 'PREPARER',
            is_active: true,
            current_status: 'ONLINE',
            assigned_queue_id: queue.id
        });
        console.log(userErr ? `  ❌ ${userErr.message}` : '  ✅ Preparer created');
    }

    // 5. Seed Delivery Slots
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
    console.log(slotErr ? `  ❌ ${slotErr.message}` : '  ✅ Delivery slots created');

    console.log('\n✨ INITIAL CONFIGURATION COMPLETE! ✨');
    console.log('System is ready for use.\n');
}
