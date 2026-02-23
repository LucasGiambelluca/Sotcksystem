import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class OrderSummaryExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        console.log('[OrderSummary] Building summary...');
        
        const rawItems = context.order_items;
        const items = Array.isArray(rawItems) ? rawItems : [];
        
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
