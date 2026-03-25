const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL or SUPABASE_KEY missing in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNodes() {
    console.log('--- INSPECTING FLOW "pedido" ---');
    const { data: flows, error } = await supabase
        .from('flows')
        .select('id, name, nodes')
        .eq('name', 'pedido')
        .limit(1);

    if (error) {
        console.error('Error fetching flow:', error);
        return;
    }

    if (!flows || flows.length === 0) {
        console.log('Flow "pedido" not found. Trying ilike...');
        const { data: altFlows } = await supabase
            .from('flows')
            .select('id, name, nodes')
            .ilike('name', '%pedido%')
            .limit(1);
            
        if (!altFlows || altFlows.length === 0) {
            console.log('No flow found at all.');
            return;
        }
        flows[0] = altFlows[0];
    }

    const flow = flows[0];
    console.log(`Flow Found: "${flow.name}" (ID: ${flow.id})`);
    
    const nodes = flow.nodes;
    if (!nodes || !Array.isArray(nodes)) {
        console.log('No nodes found in the structure.');
        return;
    }

    console.log('\nNODES LIST:');
    nodes.forEach(node => {
        console.log(`- ID: ${node.id} | Type: ${node.type} | Name/Data: ${JSON.stringify(node.data?.label || node.data?.text || '')}`);
    });
    console.log('\n--- END ---');
}

checkNodes();
