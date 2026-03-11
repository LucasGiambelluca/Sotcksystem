const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function verifyFlow() {
    console.log('Searching for "checkout_catalogo" flow...');
    const { data, error } = await supabase
        .from('flows')
        .select('*')
        .ilike('trigger_word', '%checkout_catalogo%');
    
    if (error) {
        console.error('Error querying DB:', error);
    } else {
        console.log(`Found ${data.length} matches:`);
        data.forEach(f => {
            console.log(`- ID: ${f.id}, Name: ${f.name}, Trigger: "${f.trigger_word}", Active: ${f.is_active}`);
        });
    }
}

verifyFlow();
