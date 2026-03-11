const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function checkExecutions() {
    const { data: execs, error } = await supabase
        .from('flow_executions')
        .select('*, flow:flows(name)')
        .order('started_at', { ascending: false })
        .limit(10);
    
    if (error) {
        console.error('Error fetching executions:', error);
    } else {
        console.log('--- LATEST FLOW EXECUTIONS ---');
        execs.forEach(e => {
            console.log(`[${e.started_at}] Phone: ${e.phone} | Flow: ${e.flow?.name} | Status: ${e.status} | Node: ${e.current_node_id}`);
            if (e.status === 'completed' || e.status === 'cancelled') {
                console.log(`    Completed/Cancelled at: ${e.completed_at}`);
            }
        });
    }
}

checkExecutions();
