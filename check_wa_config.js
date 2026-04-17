
const { createClient } = require('@supabase/supabase-client');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkConfig() {
    const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error('Error fetching config:', error);
        return;
    }

    console.log('Active Configs:', data.length);
    data.forEach(c => {
        console.log(`ID: ${c.id}`);
        console.log(`Token (first 10): ${c.meta_cloud_token ? c.meta_cloud_token.substring(0, 10) : 'N/A'}`);
        console.log(`Encrypted Token: ${!!c.meta_token_encrypted}`);
        console.log(`Phone ID: ${c.meta_phone_number_id}`);
    });
}

checkConfig();
