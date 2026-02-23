import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class CreateOrderExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        const rawItems = context.order_items || [];
        const items = Array.isArray(rawItems) ? rawItems : [];

        const total = items.reduce((sum: number, i: any) => sum + ((i.price || 0) * (i.qty || i.quantity || 1)), 0);
        
        // Extract address - try multiple possible variable names and typos
        const address = context.direccion || context.dirección || context.address || context.delivery_address || context.domicilio || context.dirrecion || context.respuesta || null;
        const deliveryType = context.tipo_entrega || context.delivery_type || context.respuesta_envio || null;
        
        // Extract delivery date
        const deliveryDate = context.fecha_entrega || context.fecha || context.date || context.delivery_date || null;
        
        console.log('[CreateOrderExecutor] Context keys:', Object.keys(context));
        console.log('[CreateOrderExecutor] Address:', address, '| Delivery type:', deliveryType, '| Date:', deliveryDate);

        try {
            const order = await engine.orderService.createOrder({
                phone: context.phone,
                items: items,
                total: total,
                deliverySlotId: context.selected_slot_id,
                address: address,
                deliveryDate: deliveryDate,
                paymentMethod: context.metodo_pago || context.payment_method,
                pushName: context.pushName,
                chatContext: { ...context, delivery_date: deliveryDate, delivery_type: deliveryType }
            });

            // Auto-asignación
            await engine.orderService.autoAssignOrder(order.id);

            // Fetch custom checkout message from config
            const { supabase } = require('../../config/database');
            
            const { data: config } = await supabase.from('whatsapp_config').select('checkout_message').limit(1).single();
            const checkoutMessage = config?.checkout_message?.trim() || 'El pedido ya fue enviado a cocina.';


            const replyMessages: any[] = [
                { text: `✅ *¡Pedido confirmado!*` },
                { text: `Orden: #${order.order_number}` },
                { text: `Total: *$${total}*` },
                { text: `Destino: ${address || 'Retiro en local'}` }
            ];

            if (checkoutMessage) {
                replyMessages.push({ text: checkoutMessage });
            }

            return { 
                messages: replyMessages,
                updatedContext: {
                    created_order: order
                },
                wait_for_input: false
            };
        } catch (err: any) {
            return { 
                messages: [`❌ Error al crear el pedido: ${err.message}`],
                wait_for_input: false
            };
        }
    }
}
