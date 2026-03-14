const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function diagnoseNLU() {
    console.log('--- NLU Diagnostics ---');
    console.log('URL:', process.env.SUPABASE_URL);
    
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, synonyms, price, category')
        .eq('is_active', true);

    if (error) {
        console.error('❌ Error loading products:', error.message);
        console.error('Error Code:', error.code);
        if (error.code === '42703') {
            console.error('CONSEJO: La columna "synonyms" NO existe. El usuario DEBE ejecutar el SQL.');
        }
    } else {
        console.log('✅ Products loaded successfully:', products.length);
        if (products.length > 0) {
            console.log('Sample product:', JSON.stringify(products[0], null, 2));
        } else {
            console.log('⚠️ No active products found in DB.');
        }
    }
}

diagnoseNLU();
