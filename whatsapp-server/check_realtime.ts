import { supabase } from './src/config/database';

async function checkRealtime() {
    const { data, error } = await supabase.from('orders').select('id, channel').limit(1);
    console.log("Supabase connection ok:", data);

    const channel = supabase.channel('test-realtime').on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders'
    }, (payload) => {
        console.log("RECEIVED REALTIME PAYLOAD:", payload);
    }).subscribe((status) => {
        console.log("SUBSCRIPTION STATUS:", status);
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Now trigger an update on the first order
    if (data && data.length > 0) {
        console.log("Triggering update on order", data[0].id);
        const { error: updErr } = await supabase.from('orders').update({ channel: data[0].channel }).eq('id', data[0].id);
        if (updErr) console.error("Update failed:", updErr);
        
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log("Done checking realtime. If you didn't see 'RECEIVED REALTIME PAYLOAD', realtime is OFF for the orders table.");
    process.exit(0);
}

checkRealtime();
