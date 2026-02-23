const MESSAGES = require('../config/messages');

module.exports = {
    step: 'confirm',

    async enter(session) {
        const items = session.data.items || [];
        if (items.length === 0) {
             // Should not happen, but safe guard
            return [MESSAGES.ORDER.CART_EMPTY];
        }
        
        const itemsTxt = items.map(i => `• ${i.qty}x ${i.name} ($${i.price * i.qty})`).join('\n');
        return [MESSAGES.CONFIRM.SUMMARY(itemsTxt, session.data.total)];
    },

    async handle(text, session) {
        const clean = text.toLowerCase().trim();

        if (['si', 'ok', 'confirmar', 'dale', 'siguiente', 'yes'].includes(clean)) {
            return { nextStep: 'schedule' };
        }

        if (['no', 'cancelar', 'atras'].includes(clean)) {
             // If "cancelar", global handles it? 
             // Global "cancelar" resets. 
             // Local "no" -> maybe go back to order?
             return { nextStep: 'order', messages: ["Ok, seguí pidiendo."] };
        }

        // Reprompt
        return { messages: ["¿Confirmamos el pedido? Respondé *Si* o *No*."] };
    }
};
