require('dotenv').config();
const { supabase } = require('./src/config/database');

async function simulateOrder() {
    console.log('--- Order Simulation Start (Internal DB - Valid Client) ---');
    const phone = '5492915093499';
    
    // 1. Get a product from catalog_items
    const { data: item, error: pError } = await supabase.from('catalog_items').select('*').limit(1).single();
    if (pError) {
        console.error('Error fetching catalog items:', pError);
        return;
    }
    console.log(`Using item: ${item.name} (${item.id})`);

    // 2. Create order data
    const orderData = {
        client_id: 'faee4f13-b5bc-46ea-8f59-03f953314de2', 
        phone: phone,
        status: 'PENDING',
        total_amount: item.price || 100,
        channel: 'WHATSAPP',
        delivery_address: `AUDIT TEST - ${new Date().toLocaleTimeString()}`,
        delivery_type: 'DELIVERY',
        chat_context: {
            pushName: 'Lucas Audit',
            bot_id: process.env.WHATSAPP_PHONE_NUMBER_ID || '1037744292755766'
        }
    };

    console.log('Creating order...');
    const { data: order, error } = await supabase.from('orders').insert(orderData).select().single();

    if (error) {
        console.error('Error creating order:', error);
        return;
    }

    console.log(`✅ Order created successfully: #${order.order_number} (ID: ${order.id})`);

    // 3. Create order_items
    const { error: itemError } = await supabase.from('order_items').insert({
        order_id: order.id,
        catalog_item_id: item.id,
        quantity: 1,
        unit_price: item.price || 100
    });

    if (itemError) {
        console.error('Error creating order items:', itemError);
        return;
    }
    
    console.log('✅ Items added.');
    console.log(`Order ID: ${order.id}`);
    console.log('Now waiting for bot processing...');
}

simulateOrder();
