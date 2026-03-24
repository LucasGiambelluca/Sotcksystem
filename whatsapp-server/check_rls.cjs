const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    console.log('Checking RLS for employees...');
    const { data, error } = await supabase.rpc('get_policies', { table_name: 'employees' }); // Note: RPC get_policies might not exist, using raw SQL via another way if possible.
    
    // Alternative: check if select/insert works with ANON key
    const anonClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data: selectData, error: selectError } = await anonClient.from('employees').select('*').limit(1);
    console.log('ANON SELECT ERROR:', selectError);
    
    const { error: insertError } = await anonClient.from('employees').insert({ name: 'RLS TEST', role: 'cadete' });
    console.log('ANON INSERT ERROR:', insertError);
}
run();
