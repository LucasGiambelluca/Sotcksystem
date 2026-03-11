const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function checkCatalogStations() {
    const { data: items, error } = await supabase
        .from('catalog_items')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error('Error querying catalog_items:', error);
    } else {
        console.log('Catalog item columns:', Object.keys(items[0]).filter(k => k.includes('station') || k.includes('category')));
        console.log('Sample item:', items[0]);
    }
}

checkCatalogStations();
