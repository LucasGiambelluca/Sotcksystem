require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Must use anon key or service role
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    let { data: flows, error } = await supabase.from('bot_flows').select('id, name');
    if (error) console.error("Error:", error);
    console.log("Flows:", flows);
}
check();
