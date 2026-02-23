const orderService = require('./src/services/orderService');
const { supabase } = require('./src/config/database');
const DateParser = require('./src/utils/dateParser');

(async () => {
    require('dotenv').config();
    console.log("--- Verification Test: Valid Date ---");

    const phone = "5491112345678";
    const pushName = "TestUser";
    const rawInput = "mañana 15 hs"; 
    
    // Simulate what schedule.flow.js does
    const parseResult = DateParser.parse(rawInput);
    console.log(`Parsed input "${rawInput}":`, parseResult);
    
    if (!parseResult.date) {
        console.error("Parser failed to find date!");
        return;
    }

    const total = 1000;
    
    // items mock
    const items = [
        { 
            qty: 1, 
            name: "Hamburguesa Clásica", 
            price: 500,
            product_id: null 
        }
    ];

    // Get a valid product ID
    const { data: products } = await supabase.from('products').select('id').limit(1);
    if (products && products.length > 0) {
        items[0].product_id = products[0].id;
    }

    try {
        console.log(`Attempting to create order...`);
        console.log(`Date: ${parseResult.formattedDate}`);
        console.log(`TimeSlot: ${parseResult.timeSlot}`);

        const order = await orderService.createOrder(
            phone, 
            items, 
            total, 
            parseResult.formattedDate, // YYYY-MM-DD
            parseResult.timeSlot,      // Time String
            pushName
        );
        console.log("✅ Order created successfully:", order);
    } catch (err) {
        console.error("❌ Failed to create order:");
        console.error(err);
    }
})();
