const { supabase } = require('./src/config/database');

async function test() {
    try {
        console.log("Checking DB connection...");
        const { data: catItem } = await supabase.from('catalog_items').select('id, price').limit(1).single();
        if (!catItem) {
            console.log("No catalog items found.");
            return;
        }

        console.log("Creating client since ID might be wrong...");
        const { data: nw } = await supabase.from('clients').insert({ name: 'TEST CLIENT MULTI' }).select().single();
        console.log("Client created:", nw.id);

        console.log("Inserting order...");
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                client_id: nw.id,
                channel: 'WEB',
                total_amount: catItem.price,
                status: 'PENDING'
            })
            .select()
            .single();
        
        if (orderError) {
            console.error("ORDER ERROR:", orderError);
            return;
        }
        
        console.log("Order created:", order.id);
        
        console.log("Inserting items...");
        const { error: itemsError } = await supabase
            .from('order_items')
            .insert([{
                order_id: order.id,
                catalog_item_id: catItem.id,
                quantity: 1,
                unit_price: 1000,
            }]);
        
        if (itemsError) {
             console.error("ITEMS ERROR:", itemsError);
        } else {
             console.log("Success! Items inserted.");
        }

    } catch (e) {
        console.error(e);
    }
}

test();
