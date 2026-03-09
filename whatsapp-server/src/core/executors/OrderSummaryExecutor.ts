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
                .select('items, total')
                .eq('id', context.draft_order_id)
                .single();
            
            if (draftOrder && draftOrder.items) {
                items = draftOrder.items;
                console.log(`[OrderSummary] Loaded ${items.length} items from draft_order ${context.draft_order_id}`);
            }
        }
        
        if (items.length === 0) {
            return {
                messages: ["🛒 Tu carrito está vacío. Volvé a intentar."],
                wait_for_input: false
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

        summaryText += `\n*Total: $${total}*`;

        // Store total in context for downstream nodes
        return {
            messages: [summaryText],
            updatedContext: {
                total_amount: total
            },
            wait_for_input: false
        };
    }
}
