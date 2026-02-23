require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
    const { data, error } = await supabase
        .from('flows')
        .select('*')
        .eq('id', 'a0fcadd4-11c1-45e7-b239-b2384b897aea');
    
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

run();
