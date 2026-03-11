const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function checkRPC() {
    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
        if (error) {
            console.log('RPC exec_sql probably doesnt exist or failed:', error.message);
        } else {
            console.log('RPC exec_sql exists and works!');
        }
    } catch (e) {
        console.log('Error calling RPC:', e.message);
    }
}

checkRPC();
