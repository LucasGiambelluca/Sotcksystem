const orderService = require('./src/services/OrderService');
const { supabase } = require('./src/config/database');

(async () => {
    require('dotenv').config();
    console.log("--- Reproduction Test: Invalid Date ---");

    const phone = "5491112345678";
    const pushName = "TestUser";
    const deliveryDate = "mañana 15 hs"; // The problematic input
    const total = 1000;
    
    // items mock
    const items = [
        { 
            qty: 1, 
            name: "Hamburguesa Clásica", 
            price: 500,
            product_id: null // Will fail if constraint exists, but let's test date first
        }
    ];

    // Get a valid product ID first to avoid FK constraint error on product_id
    const { data: products } = await supabase.from('products').select('id').limit(1);
    if (products && products.length > 0) {
        items[0].product_id = products[0].id;
    } else {
        console.warn("No products found, test might fail on FK.");
    }

    try {
        console.log(`Attempting to create order with date: "${deliveryDate}"`);
        const order = await orderService.createOrder(phone, items, total, deliveryDate, pushName);
        console.log("Order created successfully:", order);
    } catch (err) {
        console.error("Caught Expected Error:");
        console.error(err);
    }
})();
