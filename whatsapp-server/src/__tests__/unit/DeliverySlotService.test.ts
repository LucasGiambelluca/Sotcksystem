import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DeliverySlotService } from '../../services/DeliverySlotService';
import { testSupabase, cleanDatabase, closeConnections } from '../setup';

describe('DeliverySlotService', () => {
    let service: DeliverySlotService;

    beforeEach(async () => {
        service = new DeliverySlotService(testSupabase);
        await cleanDatabase();
    });

    afterAll(async () => {
        await closeConnections();
    });

    it('debe generar slots para los próximos días', async () => {
        await service.generateSlots(1);
        
        const { data, error } = await testSupabase
            .from('delivery_slots')
            .select('*');
        
        expect(error).toBeNull();
        expect(data?.length).toBeGreaterThan(0);
    });

    it('debe listar solo slots con cupo disponible', async () => {
        // 1. Crear un slot manualmente
        const { data: slot } = await testSupabase
            .from('delivery_slots')
            .insert({
                date: '2099-01-01',
                time_start: '12:00:00',
                time_end: '12:30:00',
                max_orders: 5,
                orders_count: 5, // LLENO
                is_available: true
            })
            .select()
            .single();

        const slots = await service.getAvailableSlots();
        const found = slots.find(s => s.id === slot.id);
        
        expect(found).toBeUndefined();
    });

    it('debe permitir reservar un slot exitosamente', async () => {
        const { data: slot } = await testSupabase
            .from('delivery_slots')
            .insert({
                date: '2099-01-01',
                time_start: '13:00:00',
                time_end: '13:30:00',
                max_orders: 5,
                orders_count: 0,
                is_available: true
            })
            .select()
            .single();

        const result = await service.reserveSlot(slot.id);
        expect(result).toBe(true);

        const { data: updatedSlot } = await testSupabase
            .from('delivery_slots')
            .select('orders_count')
            .eq('id', slot.id)
            .single();
        
        expect(updatedSlot?.orders_count).toBe(1);
    });

    it('debe fallar al reservar si el slot está lleno', async () => {
        const { data: slot } = await testSupabase
            .from('delivery_slots')
            .insert({
                date: '2099-01-01',
                time_start: '14:00:00',
                time_end: '14:30:00',
                max_orders: 1,
                orders_count: 1,
                is_available: true
            })
            .select()
            .single();

        const result = await service.reserveSlot(slot.id);
        expect(result).toBe(false);
    });

    it('debe permitir liberar un slot previamente reservado', async () => {
        const { data: slot } = await testSupabase
            .from('delivery_slots')
            .insert({
                date: '2099-01-01',
                time_start: '15:00:00',
                time_end: '15:30:00',
                max_orders: 5,
                orders_count: 1,
                is_available: true
            })
            .select()
            .single();

        await service.releaseSlot(slot.id);

        const { data: updatedSlot } = await testSupabase
            .from('delivery_slots')
            .select('orders_count')
            .eq('id', slot.id)
            .single();
        
        expect(updatedSlot?.orders_count).toBe(0);
    });
});
