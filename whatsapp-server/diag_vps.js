const { createClient } = require('@supabase/supabase-js');

const VPS_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const VPS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';
const supabase = createClient(VPS_URL, VPS_KEY);

async function diagnostic() {
    console.log('--- VPS Notification Diagnostic ---');
    
    // 1. Check Config
    const { data: config } = await supabase.from('whatsapp_config').select('*').limit(1).single();
    console.log('Template Transit:', config.template_transit);
    console.log('Template Ready:', config.template_ready);
    
    // 2. Check Last Order
    const { data: order } = await supabase.from('orders')
        .select('*, clients(name, phone)')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
    if (!order) {
        console.log('No orders found.');
        return;
    }

    console.log('\nLast Order Details:');
    console.log('ID:', order.id);
    console.log('Status:', order.status);
    console.log('Delivery Type:', order.delivery_type);
    console.log('Delivery Address:', order.delivery_address);
    console.log('Phone:', order.phone || order.clients?.phone);
    
    // 3. Test isPickup Logic (from OrderListener v2.6)
    const dtLower = (order.delivery_type || '').toLowerCase();
    const adLower = (order.delivery_address || '').toLowerCase();
    const isPickup = dtLower === 'pickup' || dtLower.includes('retiro') || dtLower.includes('local') || adLower.includes('retiro') || adLower.includes('local');
    console.log('\nisPickup detection:', isPickup);
    
    // 4. Test Template Compilation
    const orderNumber = order.order_number || order.id.slice(0, 8);
    const clientName = order.clients?.name || 'Cliente';
    const template = isPickup ? (config.template_ready || 'READY_FALLBACK') : (config.template_transit || 'TRANSIT_FALLBACK');
    
    const message = template
        .replace(/\{orderId\}/g, orderNumber)
        .replace(/\{clientName\}/g, clientName);
    
    console.log('\nCompiled Message:');
    console.log(message);
}

diagnostic();
