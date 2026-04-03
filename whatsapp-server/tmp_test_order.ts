import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL || 'http://localhost:54321', 
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

async function test() {
    console.log("Fetching client Venta Mostrador...");
    const { data: mostrador, error: err1 } = await supabase
        .from('clients')
        .select('*')
        .ilike('name', 'Venta Mostrador')
        .limit(1)
        .maybeSingle();

    let clientId = mostrador?.id;

    if (!clientId) {
        console.log("Not found, creating Venta Mostrador...");
        const { data: nw, error: nwe } = await supabase
            .from('clients')
            .insert({ name: 'Venta Mostrador' })
            .select()
            .single();
        if (nwe) {
            console.error("Client creation error:", nwe);
            return;
        }
        clientId = nw?.id;
    }

    console.log("Client ID:", clientId);

    const orderData = {
        client_id: clientId,
        channel: 'WEB',
        total_amount: 1000,
        status: 'PENDING'
    };

    console.log("Creating order...");
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            client_id: orderData.client_id,
            channel: orderData.channel,
            total_amount: 1000,
        })
        .select()
        .single();
    
    if (orderError) {
        console.error("Order creation error:", orderError);
        return;
    }

    console.log("Order created:", order.id);

    console.log("Creating item with null product_id...");
    const { error: itemsError } = await supabase
        .from('order_items')
        .insert([{
            order_id: order.id,
            product_id: null,
            catalog_item_id: null, // Just to see if it allows null for both
            quantity: 1,
            unit_price: 1000,
        }]);
    
    if (itemsError) {
        console.error("Item creation error:", itemsError);
        return;
    }

    console.log("Success!");
}

test();
