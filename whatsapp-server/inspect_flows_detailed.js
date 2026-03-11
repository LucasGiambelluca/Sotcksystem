const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function inspectFlowsDetailed() {
    const { data: flows, error } = await supabase.from('flows').select('id, name, trigger_word, nodes, edges');
    if (error) {
        console.error('Error fetching flows:', error);
        return;
    }
    console.log('--- DETAILED FLOW INSPECTION ---');
    flows.forEach(f => {
        console.log(`\nFlow: ${f.name} (ID: ${f.id})`);
        console.log(`Trigger: "${f.trigger_word}"`);
        console.log(`Nodes Count: ${f.nodes?.length || 0}`);
        if (f.nodes && f.nodes.length > 0) {
            console.log('Nodes Sample:');
            f.nodes.slice(0, 3).forEach(n => console.log(`  - NodeID: ${n.id} | Type: ${n.type || n.node_type} | Data: ${JSON.stringify(n.data).substring(0, 100)}...`));
        }
    });
}

inspectFlowsDetailed();
