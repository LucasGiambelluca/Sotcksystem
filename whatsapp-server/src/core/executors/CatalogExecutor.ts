import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';
const { productService } = require('../../services/ProductService');

export class CatalogExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        // If items are already in context (e.g. from a catalog checkout), skip sending the menu
        const items = context.order_items || [];
        if (Array.isArray(items) && items.length > 0) {
            console.log(`[CatalogExecutor] Skipping menu because ${items.length} items are already in context.`);
            return { messages: [], wait_for_input: false };
        }

        const products = await productService.getProducts();
        
        if (!products || products.length === 0) {
            return { 
                messages: ["⚠️ Lo sentimos, el catálogo está vacío en este momento."],
                wait_for_input: false // Should probably stop or go to fallback
            };
        }

        let menu = "📋 *NUESTRO MENÚ:*\n\n";
        let currentCategory = "";

        products.forEach((p: any) => {
            if (p.category !== currentCategory) {
                currentCategory = p.category || "Otros";
                menu += `\n*${currentCategory.toUpperCase()}*\n`;
            }
            menu += `• ${p.name} - *$${p.price}*\n`;
        });

        menu += "\n📝 *Cómo pedir:*\nEscribe tu pedido, por ejemplo:\n_\"2 hamburguesas clásicas y 1 coca\"_";
        
        return { 
            messages: [menu],
            wait_for_input: true 
        };
    }
}
