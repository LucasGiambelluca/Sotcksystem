import { NodeExecutor, ExecutionContext, NodeExecutionResult } from './types';
import { AIExtractor } from '../nlu/AIExtractor';
import { logger } from '../../utils/logger';

export class SendCatalogExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        
        // Prepare auto-fill parameters
        const params = new URLSearchParams();
        if (context.pushName) params.append('name', context.pushName);
        
        // Try multiple possible keys for phone
        const phone = context.phone || context.phoneNumber || context.msid;
        if (phone) {
            const cleanPhone = String(phone).split('@')[0];
            params.append('phone', cleanPhone);
        }

        // Try multiple possible keys for address
        const addr = context.direccion || context.address || context.deliveryAddress;
        if (addr) params.append('address', addr);

        const catalogSlug = process.env.CATALOG_SLUG || 'elpollocomilon';
        const catalogUrl = `${baseUrl}/${catalogSlug}/catalog${params.toString() ? '?' + params.toString() : ''}`;
        

        const message = data.customMessage
            ? `${data.customMessage}\n\n👉 ${catalogUrl}`
            : `¡Mirá nuestro catálogo online! Podés ver todos nuestros productos, elegir lo que querés y hacer tu pedido fácilmente:\n\n👉 ${catalogUrl}`;

        return {
            messages: [message],
            wait_for_input: true,
        };
    }

    async handleInput(input: string, data: any, context: ExecutionContext): Promise<{ 
        updatedContext?: Partial<ExecutionContext>; 
        messages?: string[]; 
        isValidInput?: boolean; 
    }> {
        logger.info(`[SendCatalogExecutor] Parsing potential catalog order: "${input.substring(0, 50)}..."`);
        
        // 1. Use AI to parse the items (supports the catalog format "Product xQty - $Price")
        const analysis = await AIExtractor.analyze(input);
        
        if (analysis && (analysis.intent === 'order' || analysis.items.length > 0)) {
            const items = analysis.items.map(item => ({
                id: item.resolvedProduct?.id,
                name: item.resolvedProduct?.name || item.rawName,
                price: item.resolvedProduct?.price || 0,
                qty: item.quantity,
                total: (item.resolvedProduct?.price || 0) * item.quantity
            }));

            logger.info(`[SendCatalogExecutor] Successfully parsed ${items.length} items from catalog message.`);

            return {
                updatedContext: {
                    order_items: items,
                    // If AI also extracted address or payment from the message, save them
                    deliveryAddress: analysis.address || context.deliveryAddress,
                    paymentMethod: analysis.paymentMethod || context.paymentMethod
                },
                isValidInput: true
            };
        }

        // If it's not a clear order, we still allow advancement but items will be empty
        // Or we could ask them to try again if we want to be strict.
        // For now, let's be loose to avoid blocking the flow if the user just says "gracias".
        return { isValidInput: true };
    }
}
