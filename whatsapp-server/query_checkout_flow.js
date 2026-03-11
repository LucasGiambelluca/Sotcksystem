const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function checkFlow() {
    const { data, error } = await supabase
        .from('flows')
        .select('id, name, nodes, trigger_word')
        .eq('trigger_word', 'checkout_catalogo')
        .single();
    
    if (error) {
        console.error(error);
    } else {
        console.log('Nodes for checkout_catalogo:');
        data.nodes.forEach(node => {
            console.log(`- ID: ${node.id}, Type: ${node.type}, Var: ${node.data.variable || 'N/A'}`);
            if (node.type === 'pollNode') console.log('  Options:', node.data.options);
        });
    }
}

checkFlow();
