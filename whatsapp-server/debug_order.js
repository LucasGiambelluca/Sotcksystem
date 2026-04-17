const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
async function run() {
    console.log('--- Inspecting Order #399 ---');
    const { data: order } = await supabase.from('orders').select('*').eq('order_number', 399).single();
    if (!order) {
        console.log('Order #399 not found. Checking last 5 orders instead:');
        const { data: lastJobs } = await supabase.from('orders').select('id, order_number, status, chat_context, updated_at, out_at').order('created_at', { ascending: false }).limit(5);
        console.log(JSON.stringify(lastJobs, null, 2));
    } else {
        console.log(JSON.stringify(order, null, 2));
    }
}
run();
