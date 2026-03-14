const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function inspectProducts() {
    const { data, error } = await supabase.from('products').select('*').limit(1);
    if (error) {
        console.error('Error:', error.message);
    } else if (data && data.length > 0) {
        console.log('Columns in products:', Object.keys(data[0]));
        console.log('Sample Data:', JSON.stringify(data[0], null, 2));
    } else {
        console.log('No products found or empty table.');
    }
}

inspectProducts();
