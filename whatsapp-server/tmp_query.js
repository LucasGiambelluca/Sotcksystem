const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:\\Users\\Lucas\\Desktop\\Sotcksystem\\whatsapp-server\\.env' });

const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function test() {
    try {
        console.log("Checking DB connection...");
        const { data: catItem } = await supabase.from('catalog_items').select('id, price').limit(1).single();
        if (!catItem) {
            console.log("No catalog items found.");
            return;
        }

        console.log("Inserting order...");
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                client_id: 'e1d24c08-01d0-4ad3-9118-a6646b96277b', // Known good ID or just a fake one? If foreign key fails, we see it
                channel: 'WEB',
                total_amount: catItem.price,
                status: 'PENDING'
            })
            .select()
            .single();
        
        if (orderError) {
            console.error("ORDER ERROR:", orderError);
            // Let's create a client first
            console.log("Creating client since ID might be wrong...");
            const { data: nw } = await supabase.from('clients').insert({ name: 'TEST CLIENT' }).select().single();
            const { data: order2, error: orderError2 } = await supabase
                .from('orders')
                .insert({
                    client_id: nw.id,
                    channel: 'WEB',
                    total_amount: catItem.price,
                    status: 'PENDING'
                })
                .select()
                .single();
            if (orderError2) {
                 console.error("ORDER ERROR 2:", orderError2);
                 return;
            }
            console.log("Order created:", order2.id);
            await checkItems(order2.id, catItem.id);
            return;
        }
        
        console.log("Order created:", order.id);
        await checkItems(order.id, catItem.id);

    } catch (e) {
        console.error(e);
    }
}

async function checkItems(orderId, catalogItemId) {
    console.log("Inserting items...");
    const { error: itemsError } = await supabase
        .from('order_items')
        .insert([{
            order_id: orderId,
            catalog_item_id: catalogItemId,
            quantity: 1,
            unit_price: 1000,
        }]);
    
    if (itemsError) {
         console.error("ITEMS ERROR:", itemsError);
    } else {
         console.log("Success! Items inserted.");
    }
}

test();
