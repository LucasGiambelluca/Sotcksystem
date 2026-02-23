const MESSAGES = require('../config/messages');

module.exports = {
    step: 'payment',

    async enter(session) {
        return [MESSAGES.PAYMENT.ASK];
    },

    async handle(text, session) {
        const clean = text.trim();
        const paymentMethods = {
            '1': 'EFECTIVO',
            '2': 'MERCADOPAGO',
            '3': 'TARJETA'
        };

        const selected = paymentMethods[clean];

        if (!selected) {
            return { messages: [MESSAGES.PAYMENT.INVALID] };
        }

        return {
            nextStep: 'final_confirm',
            data: { paymentMethod: selected }
        };
    }
};
