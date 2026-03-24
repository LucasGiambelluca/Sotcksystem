const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    console.log('Connecting to:', process.env.SUPABASE_URL);
    const { data, error } = await supabase.from('employees').select('*');
    if (error) {
        console.error('ERROR:', error);
    } else {
        console.log('EMPLOYEES:', data);
    }
}
run();
