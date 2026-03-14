const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function inspectFlow(flowId) {
    const { data: flow, error } = await supabase
        .from('flows')
        .select('*')
        .eq('id', flowId)
        .single();

    if (error) {
        console.error('Error fetching flow:', error.message);
        return;
    }

    console.log(`--- Flow: ${flow.name} (${flow.id}) ---`);
    console.log('Nodes:', flow.nodes.length);
    console.log('Edges:', flow.edges.length);

    console.log('\n--- Edges Map ---');
    flow.edges.forEach(e => {
        console.log(`${e.source} [${e.sourceHandle || 'default'}] -> ${e.target}`);
    });

    console.log('\n--- Nodes Types ---');
    flow.nodes.forEach(n => {
        console.log(`ID: ${n.id} | Type: ${n.type} | Name: ${n.data?.name || 'unnamed'}`);
    });
}

const targetFlowId = process.argv[2] || '2b636d4d-cade-4bb8-be25-419f54e2b41d';
inspectFlow(targetFlowId);
