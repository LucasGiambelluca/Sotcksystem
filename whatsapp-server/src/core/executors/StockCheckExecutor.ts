import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';
const { productService } = require('../../services/ProductService');
const Parser = require('../parser');

export class StockCheckExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        // data.variable: where to save the result (default: 'stock_result')
        // data.question: optional prompt message
        // The user's input comes from the previous node or context

        const prompt = data.question || '🔍 ¿Qué producto querés consultar? Escribí el nombre y la cantidad (ej: "5 hamburguesas").';

        return {
            messages: [prompt],
            wait_for_input: true
            // When input arrives, handleInputAndNext in flow.engine.ts will process it
        };
    }

    /**
     * Called by FlowEngine when user input arrives for this node.
     * Parses the input, checks stock, and returns result to save in context.
     */
    static async processInput(input: string, data: any, context: ExecutionContext): Promise<{
        updatedContext: Partial<ExecutionContext>;
        messages: string[];
    }> {
        const variableName = (data.variable || 'stock_result').trim();

        // Try to parse as a stock inquiry first ("tenes 5 hamburguesas?")
        let inquiry = Parser.detectStockInquiry(input);

        // If not detected as inquiry, try to parse as plain product reference ("5 hamburguesas")
        if (!inquiry) {
            const parsed = Parser.parse(input);
            if (parsed.length > 0) {
                inquiry = { qty: parsed[0].qty, product: parsed[0].product };
            }
        }

        // If still nothing, treat entire input as product name
        if (!inquiry) {
            inquiry = { qty: null, product: input.trim() };
        }

        // Search product
        const product = await productService.findProduct(inquiry.product);

        if (!product) {
            return {
                updatedContext: {
                    [variableName]: {
                        found: false,
                        search_term: inquiry.product,
                        product_name: null,
                        stock: 0,
                        price: 0,
                        requested_qty: inquiry.qty,
                        available: false
                    }
                },
                messages: [`❌ No encontré *"${inquiry.product}"* en nuestros productos.`]
            };
        }

        const requestedQty = inquiry.qty || 1;
        const hasEnough = product.stock >= requestedQty;
        
        const result = {
            found: true,
            search_term: inquiry.product,
            product_name: product.name,
            product_id: product.id,
            stock: product.stock,
            price: product.price,
            requested_qty: requestedQty,
            available: hasEnough,
            total_price: product.price * requestedQty
        };

        let message: string;
        if (product.stock <= 0) {
            message = `😔 *${product.name}* está agotado en este momento.`;
        } else if (hasEnough) {
            message = `✅ *${product.name}*\n📦 Stock disponible\n💰 Precio: $${product.price} c/u`;
            if (inquiry.qty) {
                message += `\n🛒 ${requestedQty}x = $${product.price * requestedQty}`;
            }
        } else {
            message = `⚠️ *${product.name}*: solo quedan *${product.stock}* (pediste ${requestedQty})\n💰 Precio: $${product.price} c/u`;
        }

        return {
            updatedContext: { [variableName]: result },
            messages: [message]
        };
    }
}
