const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function checkActiveOrders() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('status', ['PENDING', 'CONFIRMED', 'IN_PREPARATION', 'IN_TRANSIT'])
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error fetching orders:', error);
    } else {
        console.log(`Found ${orders.length} active orders:`);
        orders.forEach(o => {
            console.log(`[${o.created_at}] ID: ${o.id}, Number: ${o.order_number}, Status: ${o.status}, Total: ${o.total_amount}`);
            console.log(`    Items: ${o.order_items.map(i => `${i.quantity}x ${i.catalog_item_id || '?'}`).join(', ')}`);
        });
    }
}

checkActiveOrders();
