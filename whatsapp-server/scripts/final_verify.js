const { supabase } = require('../src/config/database');
require('dotenv').config();

async function finalCheck() {
    console.log('--- Database Connection Check ---');
    const { data: catItems, count: catCount } = await supabase.from('catalog_items').select('id', { count: 'exact' });
    const { data: products, count: prodCount } = await supabase.from('products').select('id', { count: 'exact' });
    
    console.log(`Catalog Items: ${catCount}`);
    console.log(`Products table: ${prodCount}`);
    
    const { data: activeCat } = await supabase.from('catalog_items').select('id').eq('is_active', true);
    console.log(`Active Catalog Items: ${activeCat?.length || 0}`);

    console.log('\n--- Environment Check ---');
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ OK' : '❌ MISSING');
    console.log('SUPABASE_SERVICE_KEY status:', process.env.SUPABASE_SERVICE_KEY ? (process.env.SUPABASE_SERVICE_KEY.startsWith('sb_secret') ? '⚠️ sb_secret format' : '✅ JWT format') : '❌ MISSING');
}

finalCheck();
