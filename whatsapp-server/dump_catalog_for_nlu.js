
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function dumpCatalog() {
    const { data, error } = await supabase
        .from('catalog_items')
        .select('id, name, price, is_active');
    
    if (error) {
        console.error('Error fetching catalog:', error);
        return;
    }

    console.log('--- CATALOG ITEMS ---');
    data.forEach(item => {
        console.log(`${item.id} | ${item.name} | $${item.price} | Active: ${item.is_active}`);
    });
}

dumpCatalog();
