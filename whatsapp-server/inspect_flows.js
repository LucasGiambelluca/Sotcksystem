const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function inspectFlows() {
    const { data: flows, error } = await supabase.from('flows').select('*');
    if (error) {
        console.error('Error fetching flows:', error);
        return;
    }
    console.log('--- AVAILABLE FLOWS ---');
    flows.forEach(f => console.log(`ID: ${f.id} | Name: ${f.name} | Identifier: ${f.identifier}`));

    const { data: nodes, error: nodeError } = await supabase.from('flow_nodes').select('*');
    if (nodeError) {
        console.error('Error fetching nodes:', nodeError);
        return;
    }
    console.log('\n--- FLOW NODES (Sample) ---');
    nodes.slice(0, 5).forEach(n => console.log(`FlowID: ${n.flow_id} | Type: ${n.node_type} | Content: ${JSON.stringify(n.content).substring(0, 50)}...`));
}

inspectFlows();
