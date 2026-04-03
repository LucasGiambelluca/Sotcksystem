
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function check() {
    const { data, error } = await supabase.from('printer_config').select('id').limit(1);
    if (error) {
        console.log('❌ Error:', error.message);
        console.log('Code:', error.code);
    } else {
        console.log('✅ Table exists!');
        console.log('Data:', data);
    }
}

check();
