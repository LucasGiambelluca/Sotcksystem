const deliverySlotService = require('../services/DeliverySlotService').default;

module.exports = {
    step: 'schedule',

    async enter(session) {
        try {
            const slots = await deliverySlotService.getAvailableSlots(6);
            
            if (slots.length === 0) {
                return ["⚠️ Lo sentimos, no hay horarios de entrega disponibles en este momento. Por favor, contactanos directamente."];
            }

            // Guardamos los slots en la sesión para validarlos en el handle
            session.data.availableSlots = slots.map(s => ({ id: s.id, display: s.display }));
            
            let message = "⏰ *¿Cuándo querés recibir tu pedido?*\n\nElegí una opción enviando el número:\n";
            slots.forEach((slot, index) => {
                message += `${index + 1}️⃣ ${slot.display}\n`;
            });

            return [message];
        } catch (err) {
            console.error('[ScheduleFlow] Error:', err);
            return ["⚠️ Error al obtener horarios. Intentá de nuevo más tarde."];
        }
    },

    async handle(text, session) {
        const clean = text.trim();
        const index = parseInt(clean) - 1;
        const availableSlots = session.data.availableSlots || [];

        if (isNaN(index) || index < 0 || index >= availableSlots.length) {
            return { messages: ["❌ Opción inválida. Por favor, enviá el número de una de las opciones de arriba."] };
        }

        const selectedSlot = availableSlots[index];

        return {
            nextStep: 'address',
            data: {
                deliverySlotId: selectedSlot.id,
                deliverySlotDisplay: selectedSlot.display
            }
        };
    }
};
