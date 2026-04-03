
const axios = require('axios');
require('dotenv').config();

async function test() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    const { data: zones } = await axios.get(`${supabaseUrl}/rest/v1/shipping_zones?select=*&name=eq.Barrio Peligroso`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
    
    console.log("Barrio Peligroso Zones:");
    zones.forEach(z => {
        console.log(`- ID: ${z.id} | Allow: ${z.allow_delivery}`);
        console.log(`  Polygon: ${JSON.stringify(z.polygon)}`);
    });
}

test();
