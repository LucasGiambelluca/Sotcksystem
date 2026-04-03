const { supabase } = require('./src/config/database');

async function testTabletChannel() {
    console.log("Testing channel: TABLET...");
    const { data: nw } = await supabase.from('clients').insert({ name: 'TEST TABLET' }).select().single();
    
    const { error } = await supabase
        .from('orders')
        .insert({
            client_id: nw.id,
            channel: 'TABLET',
            total_amount: 1000
        });

    if (error) {
        console.error("ERROR WITH TABLET CHANNEL:", error);
    } else {
        console.log("SUCCESS! TABLET channel is allowed.");
    }
}

testTabletChannel();
