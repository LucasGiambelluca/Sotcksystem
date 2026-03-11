const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function checkOrder() {
    console.log('--- ORDER #215 DETAILS ---');
    const { data: order } = await supabase.from('orders').select('*').eq('id', '215').maybeSingle();
    
    if (!order) {
        // Try searching by phone and recent
        const { data: recent } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(1);
        console.log('Recent order:', JSON.stringify(recent, null, 2));
    } else {
        console.log(JSON.stringify(order, null, 2));
    }
}

checkOrder();
