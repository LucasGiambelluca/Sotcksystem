
import { DeliverySlotService } from '../src/services/DeliverySlotService';

async function seed() {
    console.log('🌱 Seeding delivery slots...');
    const service = new DeliverySlotService();
    
    try {
        await service.generateSlots(7); // Generate for next 7 days
        console.log('✅ Slots generated successfully for the next 7 days.');
    } catch (error) {
        console.error('❌ Error generating slots:', error);
    }
}

seed();
