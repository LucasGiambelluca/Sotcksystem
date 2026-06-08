import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';

export class AddToCartExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        // Config from node data
        const productVar = (data.productVariable || 'stock_result').trim();
        const qtyVar = (data.qtyVariable || 'cantidad').trim();
        const detailVar = (data.detailVariable || '').trim();

        // Read product info from context
        const stockResult = context[productVar];
        if (!stockResult || !stockResult.found) {
            return {
                messages: ['⚠️ No hay producto seleccionado. Volvé a consultar el stock.'],
                wait_for_input: false
            };
        }

        // Read quantity — try the configured variable, fallback to stock_result.requested_qty, then 1
        let qty = 1;
        if (qtyVar && context[qtyVar]) {
            const parsed = parseInt(String(context[qtyVar]).trim());
            qty = isNaN(parsed) || parsed < 1 ? 1 : parsed;
        } else if (stockResult.requested_qty) {
            qty = Math.max(1, Number(stockResult.requested_qty) || 1);
        }

        // Read optional detail (size, weight, variant)
        const detail = detailVar && context[detailVar] ? String(context[detailVar]).trim() : null;

        // Build cart item
        const cartItem: any = {
            product_id: stockResult.product_id,
            name: stockResult.product_name,
            price: Number(stockResult.price) || 0,
            qty: qty,
        };
        if (detail) {
            cartItem.detail = detail;
            cartItem.name = `${stockResult.product_name} (${detail})`;
        }

        // Push into order_items array
        const currentItems: any[] = Array.isArray(context.order_items) ? [...context.order_items] : [];
        currentItems.push(cartItem);

        const total = currentItems.reduce((sum: number, i: any) => sum + ((i.price || 0) * (i.qty || 1)), 0);
        const cartCount = currentItems.length;

        // Build confirmation message
        let msg = `✅ Agregado: *${qty}x ${cartItem.name}* — $${(Number(cartItem.price) || 0) * qty}`;
        msg += `\n🛒 Carrito: ${cartCount} item${cartCount > 1 ? 's' : ''} — Total: *$${total}*`;

        return {
            messages: [msg],
            wait_for_input: false,
            updatedContext: {
                order_items: currentItems,
                total_amount: total,
                // Clear the stock result and qty for the next iteration
                [productVar]: null,
                [qtyVar]: null,
                ...(detailVar ? { [detailVar]: null } : {})
            }
        };
    }
}
