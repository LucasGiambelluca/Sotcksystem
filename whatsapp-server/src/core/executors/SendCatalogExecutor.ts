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
        
        const method = context.delivery_method || context.delivery_type || context.tipo_pedido;
        if (method) params.append('delivery_method', method);

        const catalogSlug = process.env.CATALOG_SLUG || 'elpollocomilon';
        const catalogUrl = `${baseUrl}/${catalogSlug}/catalog${params.toString() ? '?' + params.toString() : ''}`;
        

        const message = data.customMessage
            ? `${data.customMessage}\n\n👉 ${catalogUrl}`
            : `¡Hola! Para ver nuestro menú completo y hacer tu pedido más rápido, tocá el botón de abajo 👇\n\n👉 ${catalogUrl}`;

        const interactiveObj = {
            type: 'cta_url',
            body: { text: data.customMessage || "¡Hola! Para ver nuestro menú completo y hacer tu pedido más rápido, tocá el botón de abajo 👇" },
            action: {
                name: 'cta_url',
                parameters: {
                    display_text: 'Ver Catálogo',
                    url: catalogUrl
                }
            }
        };

        return {
            messages: [{ text: message, interactive: interactiveObj }],
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
            const items = analysis.items
                .filter(item => item.resolvedProduct && Number(item.resolvedProduct.price) > 0)
                .map(item => ({
                    id: item.resolvedProduct!.id,
                    name: item.resolvedProduct!.name,
                    price: Number(item.resolvedProduct!.price),
                    qty: item.quantity,
                    total: Number(item.resolvedProduct!.price) * item.quantity,
                }));
            const dropped = analysis.items.length - items.length;
            if (dropped > 0) logger.warn(`[SendCatalogExecutor] Dropped ${dropped} unresolved item(s) to avoid $0 undercharge.`);

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
