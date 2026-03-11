const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function checkData() {
    console.log('--- PRODUCT PRICE ---');
    const { data: products } = await supabase.from('products').select('name, price').ilike('name', '%arrollado%');
    console.log(JSON.stringify(products, null, 2));

    console.log('\n--- SHIPPING ZONES ---');
    const { data: zones } = await supabase.from('shipping_zones').select('*');
    console.log(JSON.stringify(zones, null, 2));
    
    console.log('\n--- BRANDING CONFIG (CATALOG) ---');
    const { data: branding } = await supabase.from('public_branding').select('*').maybeSingle();
    console.log(JSON.stringify(branding, null, 2));
}

checkData();
