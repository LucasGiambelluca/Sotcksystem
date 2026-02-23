const MESSAGES = require('../config/messages');
const orderService = require('../services/OrderService').default; // Fixed path and added .default for TS

const calendarService = require('../services/calendarService');
const sessionStore = require('../core/sessionStore');
// Import logger if needed

module.exports = {
    step: 'close',

    async enter(session) {
        try {
            // 1. Create Order in DB
            const order = await orderService.createOrder({
                phone: session.phone,
                items: session.data.items,
                total: session.data.total,
                deliverySlotId: session.data.deliverySlotId,
                address: session.data.address,
                paymentMethod: session.data.paymentMethod,
                pushName: session.data.pushName,
                chatContext: session.data
            });

            // 2. Auto-assign for KitchenFlow
            await orderService.autoAssignOrder(order.id);


            // 2. Calendar
            await calendarService.createEvent(order);



            // Fetch custom checkout message from config
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
            const { data: config } = await supabase.from('whatsapp_config').select('checkout_message').limit(1).single();
            const checkoutMessage = config?.checkout_message?.trim() || '';

            // 3. Clear Session
            await sessionStore.delete(session.phone);

            // 4. Return Success Message
            const messages = [MESSAGES.CLOSE.SUCCESS(
                order.order_number || order.id, 
                session.data.total, 
                session.data.deliverySlotDisplay || session.data.deliveryDate
            )];

            if (checkoutMessage) {
                messages.push(checkoutMessage);
            }

            return messages;


        } catch (err) {
            console.error('Close Flow Error:', err);
            return [MESSAGES.CLOSE.ERROR];
        }
    },

    async handle(text, session) {
        // Should not be reached as session is deleted.
        // If reached, it means user sent message AFTER session delete?
        // No, router checks session. If null -> welcome.
        return { }; 
    }
};
