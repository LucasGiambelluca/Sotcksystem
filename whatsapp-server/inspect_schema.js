const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function inspectTable() {
    // We can't directly list columns via the JS client easily without RPC or querying pg_catalog,
    // but we can try a dummy select or insert to see what works.
    // Better: Query information_schema if we have permissions, or just try to get one row and see keys.
    const { data, error } = await supabase
        .from('draft_orders')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error('Error querying draft_orders:', error);
    } else {
        console.log('Columns in draft_orders:', Object.keys(data[0] || {}));
        if (data.length === 0) {
            console.log('Table is empty. Attempting to get schema via RPC or just assuming columns are missing based on error.');
        }
    }
}

inspectTable();
