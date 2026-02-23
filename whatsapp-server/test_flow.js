
const { createClient } = require('@supabase/supabase-js');
const { executeDynamicFlow } = require('./flowEngine');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const LID_PHONE = '542914160868'; // From logs

async function runTest() {
    console.log('🧪 Starting Flow Logic Test...');

    // 1. Get Session for User
    let { data: session } = await supabase.from('chat_sessions').select('*').eq('phone', LID_PHONE).single();
    
    // 2. Ensure Session Exists with Flow
    // 2. Ensure Session Exists with Flow
    if (!session || !session.current_flow_id) {
        console.log('⚠️ Session missing. Searching for flow "Bienvenida (Menú)"...');
        const { data: flows } = await supabase.from('bot_flows').select('*').ilike('name', '%Bienvenida%'); 
        
        if (!flows || flows.length === 0) {
            console.error('❌ CRITICAL: Flow "Bienvenida" not found.');
            return;
        }
        
        const flow = flows[0]; // Pick first match
        console.log(`✅ Selected Flow: "${flow.name}" (${flow.id})`);
        
        if (session) {
            await supabase.from('chat_sessions').update({ current_flow_id: flow.id, step: 'START' }).eq('phone', LID_PHONE);
            session.current_flow_id = flow.id;
            session.step = 'START';
        } else {
             // Create mock session
             session = { phone: LID_PHONE, current_flow_id: flow.id, step: 'START', temp_data: {} };
        }
    } else {
        console.log(`✅ Session Found: Flow=${session.current_flow_id}`);
    }

    // 3. Fetch Flow Data
    const { data: flow } = await supabase.from('bot_flows').select('*').eq('id', session.current_flow_id).single();
    if (!flow) {
        console.error('❌ Flow not found (ID invalid)!');
        return;
    }
    
    console.log(`\n📦 Flow Structure:`);
    console.log(`- Name: ${flow.name}`);
    console.log(`- Nodes: ${flow.nodes?.length}`);
    console.log(`- Edges: ${flow.edges?.length}`);
    
    // Find Start Node
    const startNode = flow.nodes?.find(n => n.type === 'input') || flow.nodes?.[0];
    if (startNode) {
        console.log(`- Start Node: ${startNode.id} (${startNode.type})`);
        // Find edges from start
        const startEdges = flow.edges?.filter(e => e.source === startNode.id);
        console.log(`- Edges from Start:`, startEdges);
    } else {
        console.error(`❌ No Start Node found!`);
    }

    // Mock Send Function
    const mockSend = async (phone, msg) => {
        const content = typeof msg === 'object' ? JSON.stringify(msg) : msg;
        console.log(`🤖 BOT SAYS: ${content}`);
        return { key: { id: 'MOCK_ID' } };
    };

    // 4. Simulate Execution
    console.log('\n--- 🚀 EXECUTION START ---');
    
    // A. Start / Current Step
    console.log(`\n👉 Executing Current Step: ${session.step || 'START'}`);
    
    // If step is START, we need to find the specific node ID to start with?
    // flowEngine handles 'START' by looking for input node.
    
    let result = await executeDynamicFlow(session, '', flow, mockSend);
    
    if (result) {
        console.log('✅ Result 1 (After Init):', result);
        // Update session state for next step
        session.step = result.step;
        session.temp_data = result.temp_data;
        session.last_node_executed = result.last_node_executed; // CRITICAL: Update top-level
    } else {
        console.log('⏹️ Flow Ended or Paused.');
    }

    // B. Simulate Input "1" (User selects option)
    console.log(`\n👉 Simulating User Input: "1"`);
    
    // We pass the UPDATED session (with the node waiting for input, e.g. pollNode)
    result = await executeDynamicFlow(session, '1', flow, mockSend);
    
    if (result) {
        console.log('✅ Result 2 (After Input "1"):', result);
    } else {
        console.error('❌ Flow Result is NULL (Died)');
    }
}

runTest();
