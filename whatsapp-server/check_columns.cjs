const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    console.log('Checking stock_movements columns...');
    const { data, error } = await supabase.from('stock_movements').select('*').limit(1);
    
    if (error) {
        console.error('ERROR:', error);
    } else if (data && data.length > 0) {
        console.log('COLUMNS:', Object.keys(data[0]));
    } else {
        console.log('No data found to check columns.');
    }
}
run();
