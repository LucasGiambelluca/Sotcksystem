const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function debugFlow() {
    const flowId = '2b636d4d-cade-4bb8-be25-419f54e2b41d';
    const { data, error } = await supabase
        .from('flows')
        .select('nodes')
        .eq('id', flowId)
        .single();
    
    if (error) {
        console.error(error);
    } else {
        console.log('Nodes for Bienvenida flow:');
        data.nodes.forEach(node => {
            console.log(`- ID: ${node.id}, Type: ${node.type}`);
            console.log('  Data:', JSON.stringify(node.data, null, 2));
        });
    }
}

debugFlow();
