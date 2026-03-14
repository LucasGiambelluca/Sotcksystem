
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log('Recent Orders:');
    console.table(data);
}

checkOrders();
