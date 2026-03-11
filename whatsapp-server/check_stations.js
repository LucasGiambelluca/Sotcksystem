const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function checkStations() {
    // 1. Check if orders_stations table exists/has data
    const { data: assignments, error: err1 } = await supabase
        .from('orders_stations')
        .select('*')
        .limit(10);
    
    if (err1) {
        console.log('Error or table orders_stations doesnt exist:', err1.message);
    } else {
        console.log('Recent orders_stations assignments:', assignments);
    }

    // 2. Check if orders table has a station_id column (some schemas use this instead)
    const { data: cols, error: err2 } = await supabase
        .from('orders')
        .select('*')
        .limit(1);
    
    if (!err2 && cols && cols[0]) {
        console.log('Order columns key check:', Object.keys(cols[0]).filter(k => k.includes('station')));
    }
}

checkStations();
