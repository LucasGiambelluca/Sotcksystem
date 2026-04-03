import { NodeExecutor, NodeExecutionResult, ExecutionContext } from './types';
import { productService } from '../../services/ProductService';
import { logger } from '../../utils/logger';

export class ProductSearchExecutor implements NodeExecutor {
    async execute(data: any, context: ExecutionContext, engine: any): Promise<NodeExecutionResult> {
        // 1. Get search term from node data or previous input (if it's not a navigation number)
        let query = data.query || '';
        const lastInput = context.respuesta || '';
        
        if (!query && lastInput && !/^\d+$/.test(lastInput)) {
            query = lastInput;
        }

        logger.info(`[ProductSearchExecutor] Executing search for: "${query}" (Source: ${data.query ? 'NodeData' : 'UserInput'})`);

        if (!query || query.length < 2) {
            // If we already have results in context, don't wipe them! JUST re-prompt.
            // This is a safety net in case FlowEngine re-executes.
            const results = (context as any).__last_search_results || [];
            return {
                messages: ["🔍 ¿Qué te gustaría buscar? (Ej: 'bebidas', 'pizzas', 'postre')"],
                wait_for_input: true,
                updatedContext: results.length > 0 ? {} : { __last_search_results: [] }
            };
        }

        const products = await this.performSearch(query);

        if (products.length === 0) {
            return {
                messages: [`🔍 No encontré productos relacionados con "${query}". ¿Querés intentar con otra palabra?`],
                wait_for_input: true,
                updatedContext: { __last_search_results: [] }
            };
        }

        const message = this.formatMenu(products, data.message);

        return {
            messages: [message],
            wait_for_input: true,
            updatedContext: {
                __last_search_results: products.map(p => ({
                    id: p.id,
                    name: p.name,
                    price: productService.getEffectivePrice(p)
                }))
            }
        };
    }

    private async performSearch(query: string) {
        if (!query || query.length < 2) return [];
        let products = await productService.findProductsByCategory(query);
        if (products.length === 0) {
            products = await productService.searchSimilarProducts(query);
        }
        return products;
    }

    private formatMenu(products: any[], customTitle?: string): string {
        const menuLines = products.map((p, i) => {
            const price = productService.getEffectivePrice(p);
            return `*${i + 1}.* ${p.name} — *$${price}*`;
        }).join('\n');

        return `${customTitle || '🔍 Resultados de búsqueda:'}\n\n${menuLines}\n\n_Respondé con el número para sumarlo o escribí otra búsqueda._`;
    }

    async handleInput(input: string, data: any, context: ExecutionContext): Promise<{ 
        updatedContext?: Partial<ExecutionContext>; 
        messages?: string[]; 
        isValidInput?: boolean; 
    }> {
        const results = (context as any).__last_search_results || [];

        // 1. Check if it's a numeric selection
        const numericMatch = input.replace(/[\*_]/g, '').match(/\d+/);
        const index = numericMatch ? parseInt(numericMatch[0]) - 1 : -1;

        if (index >= 0 && index < results.length) {
            const selected = results[index];
            const currentItems = Array.isArray(context.order_items) ? [...context.order_items] : [];
            
            currentItems.push({
                id: selected.id,
                name: selected.name,
                price: selected.price,
                qty: 1,
                total: selected.price
            });

            logger.info(`[ProductSearchExecutor] Selection: "${selected.name}" added.`);

            return {
                updatedContext: {
                    order_items: currentItems,
                    __last_search_results: [] 
                },
                messages: [`✅ ¡Sumado! *${selected.name}* ya está en tu pedido.`],
                isValidInput: true
            };
        }

        // 2. If not a number, treat as a NEW SEARCH
        logger.info(`[ProductSearchExecutor] Input "${input}" not a number. Retrying search...`);
        const newProducts = await this.performSearch(input);

        if (newProducts.length > 0) {
            const newResults = newProducts.map(p => ({
                id: p.id,
                name: p.name,
                price: productService.getEffectivePrice(p)
            }));

            return {
                isValidInput: false, // Stay in node to pick from NEW results
                messages: [this.formatMenu(newProducts, `🔍 Resultados para "${input}":`)],
                updatedContext: {
                    __last_search_results: newResults
                }
            };
        }

        return {
            isValidInput: false,
            messages: [`⚠️ No encontré "${input}". ¿Querés probar con otra palabra o elegir uno de la lista anterior?`]
        };
    }
}
