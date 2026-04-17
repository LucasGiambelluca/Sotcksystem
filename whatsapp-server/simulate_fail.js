const { createClient } = require('@supabase/supabase-js');

const NUM = '5492915093499';

async function simulate(url, key, label) {
    console.log(`\n--- Simulating on ${label} ---`);
    const supabase = createClient(url, key);
    
    // Use UPPERCASE for VPS, lowercase for LOCAL if needed, but let's try UPPERCASE for both
    const status_pending = label === 'VPS' ? 'PENDING' : 'pending';
    const status_preparing = label === 'VPS' ? 'IN_PREPARATION' : 'preparing';
    const status_out = label === 'VPS' ? 'OUT_FOR_DELIVERY' : 'OUT_FOR_DELIVERY'; // Code uses upper for this one

    // 1. Create Order
    const { data: order, error: e1 } = await supabase.from('orders').insert({
        phone: NUM,
        status: status_pending,
        total_amount: 1515,
        delivery_type: 'Delivery',
        delivery_address: 'Calle Falsa 123 (V2.6 Test)',
        chat_context: { pushName: 'Lucas Test', bot_id: '5492914444091' }
    }).select().single();

    if (e1) {
        console.error('Error creating order:', e1.message);
        return;
    }
    console.log(`Order created: ${order.id} (#${order.order_number})`);

    // 2. Transition
    await supabase.from('orders').update({ status: status_preparing }).eq('id', order.id);
    console.log('Moved to Preparing.');

    // 3. Final Transition
    const { error: e3 } = await supabase.from('orders').update({ 
        status: status_out,
        out_at: new Date().toISOString()
    }).eq('id', order.id);

    if (e3) {
        console.error('Error in e3:', e3.message);
    } else {
        console.log(`Final transition to ${status_out} done!`);
    }
}

const LOCAL_URL = 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co';
const LOCAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MSwiZXhwIjoyMDg5NjAxODgxfQ.gYQ5UXEKqWePvP5JPVGWnQ0jQKlqLpXFYDR77oSSq_c';
const VPS_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const VPS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';

async function run() {
    await simulate(LOCAL_URL, LOCAL_KEY, 'LOCAL');
    await simulate(VPS_URL, VPS_KEY, 'VPS');
}
run();
