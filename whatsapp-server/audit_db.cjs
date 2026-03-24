const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    console.log('Auditing database tables...');
    
    // We can't use rpc if not defined, but we can try to query a common view
    // Or just try a lot of likely names
    const likelyTables = [
        'clients', 'products', 'orders', 'order_items', 'stock_movements',
        'employees', 'stations', 'shifts', 'whatsapp_config', 'catalog_items',
        'shipping_zones', 'delivery_slots', 'users', 'auth_users'
    ];
    
    const results = {};
    for (const t of likelyTables) {
        const { error } = await supabase.from(t).select('id').limit(1);
        results[t] = error ? `ERROR: ${error.message}` : 'EXISTS';
    }
    console.log('Results:', JSON.stringify(results, null, 2));
}
run();
