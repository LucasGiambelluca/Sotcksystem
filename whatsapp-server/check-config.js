
const axios = require('axios');
require('dotenv').config();

async function test() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    const { data } = await axios.get(`${supabaseUrl}/rest/v1/whatsapp_config?select=*`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
    console.log("whatsapp_config data:", JSON.stringify(data, null, 2));
}

test();
