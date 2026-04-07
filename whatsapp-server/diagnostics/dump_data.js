const { supabase } = require('./config/database');

async function dump() {
    console.log('--- SHIPPING ZONES ---');
    const { data: zones } = await supabase.from('shipping_zones').select('*');
    console.log(JSON.stringify(zones, null, 2));

    console.log('\n--- WHATSAPP CONFIG ---');
    const { data: config } = await supabase.from('whatsapp_config').select('*').maybeSingle();
    console.log(JSON.stringify(config, null, 2));
    
    process.exit(0);
}

dump();
