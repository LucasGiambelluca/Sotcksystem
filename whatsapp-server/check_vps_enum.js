const { createClient } = require('@supabase/supabase-js');

async function checkEnum(url, key) {
    const supabase = createClient(url, key);
    // Since I can't run rpc exec_sql, I'll try to find an order and see its status capitalization
    const { data: orders } = await supabase.from('orders').select('status').limit(10);
    if (orders && orders.length > 0) {
        console.log('Actual statuses in DB:', Array.from(new Set(orders.map(o => o.status))));
    } else {
        console.log('No orders to check.');
    }
}

const VPS_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const VPS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';

checkEnum(VPS_URL, VPS_KEY);
