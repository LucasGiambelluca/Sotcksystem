const DeliverySlotService = require('./src/services/DeliverySlotService').default;

async function seed() {
    console.log('Generating initial delivery slots...');
    try {
        await DeliverySlotService.generateSlots(2); // Generar para hoy y mañana
        console.log('✅ Slots generated successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error generating slots:', err);
        process.exit(1);
    }
}

seed();
