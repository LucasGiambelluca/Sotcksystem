const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function findNode() {
    const flowId = 'a615026e-6b31-4799-b989-80809c6be2c6';
    const nodeId = 'node_1772982265418_7e4bi5tdj';
    
    const { data: flow, error } = await supabase.from('flows').select('nodes').eq('id', flowId).single();
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    const node = flow.nodes.find(n => n.id === nodeId);
    console.log('--- NODE DETAIL ---');
    console.log(JSON.stringify(node, null, 2));
}

findNode();
