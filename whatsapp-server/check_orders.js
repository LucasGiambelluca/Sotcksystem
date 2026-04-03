const { supabase } = require('./src/config/database');

async function checkRecentOrders() {
    console.log("Checking recent orders...");
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: orders, error } = await supabase
        .from('orders')
        .select(`
            id, 
            channel, 
            total_amount, 
            created_at,
            client:clients(name)
        `)
        .gt('created_at', tenMinsAgo)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }

    if (!orders || orders.length === 0) {
        console.log("No orders found in the last 10 minutes.");
        return;
    }

    console.table(orders.map(o => ({
        id: o.id.slice(0, 8),
        client: o.client?.name || '?',
        channel: o.channel,
        total: o.total_amount,
        time: o.created_at
    })));
}

checkRecentOrders();
