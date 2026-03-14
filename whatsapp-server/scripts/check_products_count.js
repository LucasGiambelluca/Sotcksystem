const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    const { data, error } = await supabase.from('products').select('is_active');
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    console.log('Total products:', data.length);
    console.log('Active:', data.filter(p => p.is_active).length);
    console.log('Inactive:', data.filter(p => !p.is_active).length);
    
    if (data.length > 0) {
        console.log('Sample row is_active value:', data[0].is_active);
    }
}

check();
