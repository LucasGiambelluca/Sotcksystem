import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class OrderSummaryExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        console.log('[OrderSummary] Building summary...');
        
        let items = Array.isArray(context.order_items) ? context.order_items : [];
        
        // V2: If we are in a catalog checkout flow, load items from draft_orders
        if (context.draft_order_id) {
            const { supabase } = require('../../config/database');
            const { data: draftOrder } = await supabase
                .from('draft_orders')
                .select('items, total, delivery_fee')
                .eq('id', context.draft_order_id)
                .single();
            
            if (draftOrder && draftOrder.items) {
                items = draftOrder.items;
                if (draftOrder.delivery_fee > 0) {
                    context.shipping_cost = draftOrder.delivery_fee;
                }
                console.log(`[OrderSummary] Loaded ${items.length} items from draft_order ${context.draft_order_id}`);
            }
        }
        
        if (items.length === 0) {
            return {
                messages: ["🛒 Tu carrito está vacío. Por favor, volvé al menú para elegir tus productos."],
                wait_for_input: true
            };
        }

        let summaryText = '🛒 *Resumen de tu pedido:*\n\n';
        let total = 0;

        for (const item of items) {
            const qty = item.qty || item.quantity || 1;
            const price = item.price || 0;
            const lineTotal = price * qty;
            total += lineTotal;
            summaryText += `• ${qty}x ${item.name} — $${lineTotal}\n`;
        }

        const shippingFee = Number(context.shipping_cost) || 0;
        if (shippingFee > 0) {
            summaryText += `\n*Envío:* $${shippingFee}`;
        }

        summaryText += `\n*Total: $${total + shippingFee}*`;

        // Store total in context for downstream nodes
        return {
            messages: [summaryText],
            updatedContext: {
                total_amount: total + shippingFee
            },
            wait_for_input: false
        };
    }
}
