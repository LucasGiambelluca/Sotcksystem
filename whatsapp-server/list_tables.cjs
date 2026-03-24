const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    console.log('Listing all tables...');
    // query information_schema.tables
    const { data, error } = await supabase.rpc('get_tables'); // Or try selecting from a system table if possible, or just guessing common ones.
    
    if (error) {
        console.log('RPC get_tables failed, trying alternative...');
        // Try a common table to see if we can at least connect
        const { data: d2, error: e2 } = await supabase.from('employees').select('id').limit(1);
        console.log('Employees check:', d2 ? 'OK' : e2);
        
        // Let's use a trick: query a non-existent table and hope the error hint lists tables
        const { error: e3 } = await supabase.from('non_existent_table_xyz').select('*');
        console.log('HINT:', e3.hint);
    } else {
        console.log('TABLES:', data);
    }
}
run();
