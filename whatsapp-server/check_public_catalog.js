const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function checkData() {
    console.log('--- PUBLIC CATALOG PRICE ---');
    const { data: catalog } = await supabase.from('public_catalog').select('name, price, is_special, special_price').ilike('name', '%arrollado%');
    console.log(JSON.stringify(catalog, null, 2));
}

checkData();
