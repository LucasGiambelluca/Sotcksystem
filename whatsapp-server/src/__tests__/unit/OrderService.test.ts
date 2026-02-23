import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { OrderService } from '../../services/OrderService';
import { DeliverySlotService } from '../../services/DeliverySlotService';
import { testSupabase, cleanDatabase, closeConnections } from '../setup';

describe('OrderService', () => {
    let orderService: OrderService;
    let slotService: DeliverySlotService;

    beforeEach(async () => {
        slotService = new DeliverySlotService(testSupabase);
        orderService = new OrderService(testSupabase, slotService);
        await cleanDatabase();

        // Seed un producto de prueba
        await testSupabase.from('products').insert({
            id: '00000000-0000-0000-0000-000000000001',
            name: 'Hamburguesa de Test',
            price: 1000,
            stock: 10,
            category: 'Test'
        });

        // Seed un slot de prueba
        await testSupabase.from('delivery_slots').insert({
            id: '00000000-0000-0000-0000-000000000002',
            date: '2099-01-01',
            time_start: '20:00:00',
            time_end: '20:30:00',
            max_orders: 5,
            orders_count: 0,
            is_available: true
        });
    });

    afterAll(async () => {
        await closeConnections();
    });

    it('debe crear un pedido y sus items correctamente', async () => {
        const orderParams = {
            phone: '123456789',
            pushName: 'Test User',
            total: 2000,
            deliverySlotId: '00000000-0000-0000-0000-000000000002',
            address: 'Calle Falsa 123',
            paymentMethod: 'CASH',
            items: [
                { product_id: '00000000-0000-0000-0000-000000000001', qty: 2, price: 1000 }
            ]
        };

        // Reset slot count to ensure it's not full from previous runs if cleanDatabase wasn't perfect
        await testSupabase.from('delivery_slots').update({ orders_count: 0 }).eq('id', '00000000-0000-0000-0000-000000000002');

        const order = await orderService.createOrder(orderParams);
        
        expect(order).toBeDefined();
        expect(order.total_amount).toBe(2000);
        expect(order.delivery_address).toBe('Calle Falsa 123');

        // Verificar items
        const { data: items } = await testSupabase
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);
        
        expect(items?.length).toBe(1);
        expect(items?.[0].quantity).toBe(2);
    });

    it('debe fallar si el slot no tiene disponibilidad', async () => {
        // Llenar el slot
        await testSupabase
            .from('delivery_slots')
            .update({ orders_count: 5 })
            .eq('id', '00000000-0000-0000-0000-000000000002');

        const orderParams = {
            phone: '123456789',
            total: 1000,
            deliverySlotId: '00000000-0000-0000-0000-000000000002',
            items: [{ product_id: '00000000-0000-0000-0000-000000000001', qty: 1, price: 1000 }]
        };

        await expect(orderService.createOrder(orderParams)).rejects.toThrow('Lo sentimos, el horario elegido ya no tiene cupo disponible.');
    });

    it('debe asignar automáticamente a un preparador si hay uno disponible', async () => {
        // 1. Crear Cola de preparación
        const { data: queue } = await testSupabase.from('preparation_queues').insert({
            name: 'Cocina Test'
        }).select().single();

        // 2. Crear preparador con cola asignada y nombre único
        const uniqueName = `Cocinero-${Date.now()}`;
        const { data: preparer, error: prepError } = await testSupabase.from('users').insert({
            name: uniqueName,
            role: 'PREPARER',
            is_active: true,
            current_status: 'ONLINE',
            assigned_queue_id: queue.id
        }).select().single();

        if (prepError) console.error('Error creating preparer:', prepError);

        // 3. Crear pedido
        const order = await orderService.createOrder({
            phone: '111111',
            total: 500,
            items: [{ product_id: '00000000-0000-0000-0000-000000000001', qty: 1, price: 500 }]
        });

        // 4. Asignar
        const assignedPreparerId = await orderService.autoAssignOrder(order.id);
        expect(assignedPreparerId).toBe(preparer.id);

        const { data: updatedOrder } = await testSupabase
            .from('orders')
            .select('assigned_to, status')
            .eq('id', order.id)
            .single();

        expect(updatedOrder?.assigned_to).toBe(preparer.id);
        expect(updatedOrder?.status).toBe('CONFIRMED');
    });
});
