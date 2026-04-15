require('dotenv').config();
const { supabase } = require('./src/config/database');

async function updateStatus(orderId, newStatus) {
    console.log(`--- Updating Order ${orderId} status to ${newStatus} ---`);
    const { data: order, error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .select('*, items:order_items(*)')
        .single();

    if (error) {
        console.error('Error updating status:', error);
        return;
    }

    console.log(`✅ Status updated to ${newStatus} for #${order.order_number}`);
    console.log(`Current updated_at in DB: ${order.updated_at}`);
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node update_status.js <orderId> <status>');
    process.exit(1);
}

updateStatus(args[0], args[1]);
