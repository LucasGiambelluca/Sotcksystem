const MESSAGES = require('../config/messages');

module.exports = {
    step: 'final_confirm',

    async enter(session) {
        const items = session.data.items || [];
        const itemsTxt = items.map(i => `• ${i.qty}x ${i.name} ($${i.price * i.qty})`).join('\n');
        
        return [MESSAGES.FINAL_CONFIRM.SUMMARY(
            itemsTxt,
            session.data.total,
            session.data.deliverySlotDisplay,
            session.data.address,
            session.data.paymentMethod
        )];
    },

    async handle(text, session) {
        const clean = text.toLowerCase().trim();

        if (['si', 'sì', 'si confirmamos', 'confirmar', 'dale'].includes(clean)) {
            return { nextStep: 'close' };
        }

        if (['no', 'modificar', 'cambiar'].includes(clean)) {
            return { 
                nextStep: 'order', 
                messages: ["Entendido. ¿Qué querés modificar? Podés seguir agregando productos o escribir 'Cancelar' para empezar de cero."] 
            };
        }

        return { messages: ["Por favor, respondé *SÍ* para confirmar el pedido o *NO* para volver atrás y modificar."] };
    }
};
