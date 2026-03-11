const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function listFlows() {
    const { data, error } = await supabase
        .from('flows')
        .select('id, name, trigger_word, is_active');
    
    if (error) {
        console.error(error);
    } else {
        console.log('Available Flows in DB:');
        data.forEach(f => {
            console.log(`- Name: ${f.name}, Trigger: ${f.trigger_word}, ID: ${f.id}, Active: ${f.is_active}`);
        });
    }
}

listFlows();
