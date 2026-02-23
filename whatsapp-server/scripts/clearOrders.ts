
const { supabase } = require('../src/config/database');

async function clearOrders() {
    console.log('🗑️  Starting cleanup of orders...');

    try {
        // 1. Delete Route Orders (Foreign Key to Orders)
        const { error: routeOrdersError } = await supabase
            .from('route_orders')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
        
        if (routeOrdersError) throw new Error(`Error clearing route_orders: ${routeOrdersError.message}`);
        console.log('✅ Route Orders cleared.');

        // 2. Delete Order Items (Foreign Key to Orders)
        const { error: orderItemsError } = await supabase
            .from('order_items')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (orderItemsError) throw new Error(`Error clearing order_items: ${orderItemsError.message}`);
        console.log('✅ Order Items cleared.');

        // 3. Delete Orders
        const { error: ordersError } = await supabase
            .from('orders')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (ordersError) throw new Error(`Error clearing orders: ${ordersError.message}`);
        console.log('✅ Orders cleared.');

        console.log('🎉 Cleanup finished successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}

clearOrders();
