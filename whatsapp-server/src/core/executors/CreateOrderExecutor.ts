import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class CreateOrderExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        let items = Array.isArray(context.order_items) ? context.order_items : [];
        let total = items.reduce((sum: number, i: any) => sum + ((i.price || 0) * (i.qty || i.quantity || 1)), 0);
        let pushName = context.pushName;
        const { supabase } = require('../../config/database');
        
        // V2: Process Draft Orders automatically
        if (context.draft_order_id) {
            const { data: draftOrder } = await supabase.from('draft_orders').select('*').eq('id', context.draft_order_id).single();
            if (draftOrder && draftOrder.items) {
                 items = Array.isArray(draftOrder.items) ? draftOrder.items : [];
                 total = draftOrder.total;
                 pushName = draftOrder.push_name || pushName;
                 
                 // Strict Stock Re-Validation for Catalog V2
                 const { productService } = require('../../services/ProductService');
                 for (const item of items) {
                     const product = await productService.findProduct(item.product_id || item.product);
                     if (!product) {
                         return { messages: [`❌ El producto ${item.name} ya no está disponible.`], wait_for_input: false };
                     }
                     if (product.stock < item.qty && !product.auto_refill) {
                         return { messages: [`⚠️ Perdón, nos quedamos sin stock de ${item.name} (Quedan ${product.stock}).\n\nPor favor, escribí *menú* para empezar un nuevo pedido con el stock actualizado.`], wait_for_input: false };
                     }
                 }
                 
                 // Mark draft as converted
                 await supabase.from('draft_orders').update({ status: 'converted' }).eq('id', context.draft_order_id);
            }
        }
        
        // Extract address - try multiple possible variable names and typos
        const address = context.direccion || context.dirección || context.address || context.delivery_address || context.domicilio || context.dirrecion || context.respuesta || null;
        const deliveryType = context.tipo_entrega || context.delivery_type || context.respuesta_envio || context.delivery_method || null;
        
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
                pushName: pushName,
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
