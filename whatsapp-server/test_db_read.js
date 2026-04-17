const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
async function run() {
    const { data } = await supabase.from('whatsapp_config').select('store_address, store_lat, store_lng, template_transit').single();
    console.log('--- Config ---');
    console.log(data);
    
    // Y veamos si la orden tiene el error
    const { data: ord } = await supabase.from('orders').select('id, delivery_address, delivery_type').order('created_at', { ascending: false }).limit(2);
    console.log('--- Ultimas Ordenes ---');
    console.log(ord);
}
run();
