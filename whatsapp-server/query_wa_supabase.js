require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('\n--- FLOWS ---');
    const { data: flows } = await supabase.from('flows').select('id, name, nodes, edges').eq('is_active', true);
    if (flows) {
      flows.forEach(f => {
        console.log(`\nFlow: ${f.name} (${f.id})`);
        
        // Find any node with text containing 'Pedido Confirmado'
        const confirmNodes = f.nodes.filter(n => JSON.stringify(n).includes('Pedido Confirmado'));
        console.log(`Found ${confirmNodes.length} nodes with 'Pedido Confirmado'`);
        confirmNodes.forEach(n => console.log('Node:', JSON.stringify(n, null, 2)));

        console.log('\nEdges count:', f.edges?.length || 0);
      });
    }

    console.log('\n--- EXECUTIONS LOOP ---');
    const { data: execs } = await supabase.from('flow_executions').select('*').eq('status', 'active');
    if (execs) console.log(`Active executions: ${execs.length}`);
    
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
