const { createClient } = require('@supabase/supabase-js');

const URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';
const supabase = createClient(URL, KEY);

async function checkOrder404() {
    console.log('--- Checking Order #404 on VPS ---');
    const { data: order } = await supabase.from('orders').select('*').eq('order_number', 404).single();
    if (!order) {
        console.log('Order #404 not found');
        return;
    }
    console.log('Order Details:', JSON.stringify(order, null, 2));

    const { data: items } = await supabase.from('order_items').select('*, products(name)').eq('order_id', order.id);
    console.log('Order Items:', JSON.stringify(items, null, 2));
}

checkOrder404();
