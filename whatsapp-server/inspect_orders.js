const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function inspectOrders() {
    const { data: latestOrder, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
    
    if (error) {
        console.error('Error querying orders:', error);
    } else {
        console.log('Latest order sample:', latestOrder && latestOrder[0]);
    }
}

inspectOrders();
