const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const FlowEngine = require('./flowEngine');
const ConversationBrain = require('./conversationBrain');
const OrderService = require('./services/OrderService');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const orderService = new OrderService(supabase);
const flowEngine = new FlowEngine(supabase, orderService);
const brain = new ConversationBrain(supabase, flowEngine);

const TEST_PHONE = '5491199999999';

async function testSpecificFlow() {
    console.log('🔍 Finding Flow with keyword "pedido" ...');
    const { data: flows } = await supabase.from('bot_flows').select('*').ilike('trigger_keyword', 'pedido');
    
    if (!flows || flows.length === 0) {
        console.log('❌ No flow found for "pedido"');
        return;
    }

    const flow = flows[0];
    console.log(`✅ Found Flow: "${flow.name}" (${flow.id})`);
    console.log(`   Nodes: ${flow.nodes?.length || 0}`);
    console.log(`   Edges: ${flow.edges?.length || 0}`);

    // Reset
    await brain.deleteSession(TEST_PHONE);

    // Trigger
    console.log(`\n🤖 Triggering flow for ${TEST_PHONE}...`);
    let response = await brain.processMessage(TEST_PHONE, 'pedido');
    printResponse(response);

    // If response asks for something, we continue
    // Assume it asks for Name (Standard Order Flow)
    // We'll just loop input a few times to see where it goes
    
    const inputs = ['Juan Simulation', 'Calle Falsa 123', '2 hamburguesas', 'listo', 'si'];
    
    for (const input of inputs) {
        // Only continue if not finished?? 
        // We can't easily check "finished" state from outside without peeking DB or return val.
        // processMessage returns string usually.
        
        console.log(`\n--- USER: "${input}" ---`);
        response = await brain.processMessage(TEST_PHONE, input);
        printResponse(response);
        
        if (typeof response === 'string' && response.includes('Fin')) break;
    }
}

function printResponse(res) {
   if (typeof res === 'object') {
       console.log(`🤖 BOT (Object):`, JSON.stringify(res, null, 2));
   } else {
       console.log(`🤖 BOT: "${res}"`);
   }
}

testSpecificFlow();
