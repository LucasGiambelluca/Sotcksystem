const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function checkOrders() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false })
        .limit(5);
    
    if (error) {
        console.error('Error fetching orders:', error);
    } else {
        console.log('Latest 5 orders:');
        orders.forEach(o => {
            console.log(`[${o.created_at}] ID: ${o.id}, Number: ${o.order_number}, Status: ${o.status}, Total: ${o.total_amount}`);
            console.log(`    Items: ${o.order_items.map(i => `${i.quantity}x ${i.catalog_item_id || '?'}`).join(', ')}`);
        });
    }
}

checkOrders();
