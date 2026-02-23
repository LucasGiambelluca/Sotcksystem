const MESSAGES = require('../config/messages');

module.exports = {
    step: 'address',

    async enter(session) {
        return [MESSAGES.ADDRESS.ASK];
    },

    async handle(text, session) {
        const address = text.trim();
        if (address.length < 5) {
            return { messages: ["⚠️ Por favor, danos una dirección un poco más detallada para que el repartidor pueda encontrarte."] };
        }

        return {
            nextStep: 'payment',
            data: { address }
        };
    }
};
