const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function checkDraftOrders() {
    const { data: drafts, error } = await supabase
        .from('draft_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) {
        console.error('Error fetching draft_orders:', error);
    } else {
        console.log('Recent 10 draft_orders:');
        drafts.forEach(d => {
            console.log(`[${d.created_at}] ID: ${d.id}, Phone: ${d.phone}, Status: ${d.status}, Total: ${d.total}`);
            console.log(`    Delivery: ${d.delivery_method}, Payment: ${d.payment_method}`);
        });
    }
}

checkDraftOrders();
