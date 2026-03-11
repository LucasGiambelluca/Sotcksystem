const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function checkFlows() {
    const { data, error } = await supabase
        .from('flows')
        .select('id, name, trigger_word')
        .ilike('trigger_word', '%stock%');
    
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

checkFlows();
