const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
async function run() {
    const { data: ord } = await supabase.from('orders').select('id, status, updated_at').order('created_at', { ascending: false }).limit(1).single();
    console.log('--- Order Before Update ---');
    console.log(ord);
    
    // update status to trigger
    await supabase.from('orders').update({ notes: 'test_trigger_' + Date.now() }).eq('id', ord.id);
    
    // delay to wait for trigger processing
    await new Promise(r => setTimeout(r, 1000));
    
    const { data: ordAfter } = await supabase.from('orders').select('id, status, updated_at').eq('id', ord.id).single();
    console.log('--- Order After Update ---');
    console.log(ordAfter);
    
    if (ord.updated_at === ordAfter.updated_at) {
        console.log('!!! FALLA: El updated_at es igual. El trigger NO esta funcionando. !!!');
    } else {
        console.log('OK: El updated_at cambio. El trigger Si esta funcionando.');
    }
}
run();
