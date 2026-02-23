
const ConversationBrain = require('./conversationBrain');
const FlowEngine = require('./flowEngine');
const { createClient } = require('@supabase/supabase-js');
const { Mutex } = require('async-mutex');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const flowEngine = new FlowEngine();
const brain = new ConversationBrain(supabase, flowEngine);

const PHONE = '5491100000000';
const TENANT = '00000000-0000-0000-0000-000000000000';

async function step(input, label) {
    console.log(`\n👤 USER (${label}): "${input}"`);
    const res = await brain.processMessage(PHONE, input, TENANT);
    console.log('🧠 BRAIN:', typeof res === 'object' ? JSON.stringify(res, null, 2) : `"${res}"`);
    await new Promise(r => setTimeout(r, 500)); // small delay
}

async function runSimulation() {
    console.log('🤖 Starting COMPREHENSIVE Brain Simulation...');

    // 0. Clean Slate
    await brain.deleteSession(PHONE);
    console.log('🧹 Session Cleared');

    // 1. Trigger "Hola" -> Welcome -> Menu
    await step('Hola', 'Greeting');

    // 2. Select Option 1 (Hacer Pedido) -> Redirects to "Pedido" flow?
    // Note: Current logic for "1" in Menu (Poll) might just show text instructions.
    // Let's see what it does.
    await step('1', 'Select Option 1');

    // 3. User types "Pedido" (Trigger for Order Flow)
    await step('Pedido', 'Trigger Order Flow');

    // 4. Fill Name
    await step('Juan Perez', 'Enter Name');

    // 5. Fill Address
    await step('Calle Falsa 123', 'Enter Address');

    // 6. Interaction with Catalog
    await step('2 kg de asado', 'Order Item 1');
    
    // 7. Another item
    await step('1 coca cola', 'Order Item 2');

    // 8. Global Escape
    await step('Menu', 'Global Escape');

    // 9. Verify Reset
    await step('Hola', 'Greeting after Reset');
}

runSimulation();
