const { supabase } = require('../src/config/database');
require('dotenv').config();

async function dump() {
    const phone = '176295539376186';
    console.log(`Dumping sessions for ${phone}...`);
    const { data, error } = await supabase
        .from('flow_executions')
        .select('id, session_id, status, current_node_id, version, updated_at, flow_id')
        .eq('phone', phone)
        .order('updated_at', { ascending: false });
    
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

dump();
