import { EntityExtractor, ExtractedEntity } from './EntityExtractor';
import { logger } from '../../utils/logger';

export interface InterpretedIntent {
    type: 'direct_order' | 'product_inquiry' | 'category_inquiry' | 'greeting' | 'ambiguous' | 'unknown';
    confidence: number;
    entities: ExtractedEntity[];
    parsedOrder?: {
        items: Array<{
            productId: string;
            productName: string;
            quantity: number;
            basePrice: number;
            confidence: number;
        }>;
    };
}

export class OrderInterpreter {
    private extractor: EntityExtractor;

    constructor(extractor: EntityExtractor) {
        this.extractor = extractor;
    }

    /**
     * Interprets raw text into a structured intent
     */
    async interpret(text: string): Promise<InterpretedIntent> {
        const entities = await this.extractor.extract(text);
        
        // 1. Basic Intent Classification
        const intentType = this.classifyIntent(entities, text);
        
        // 2. Intent Handling
        switch (intentType) {
            case 'direct_order':
                return this.handleDirectOrder(entities, text);
            case 'category_inquiry':
                return { type: 'category_inquiry', confidence: 0.9, entities };
            case 'product_inquiry':
                return { type: 'product_inquiry', confidence: 0.85, entities };
            case 'greeting':
                return { type: 'greeting', confidence: 0.9, entities };
            case 'unknown':
                return { type: 'unknown', confidence: 0.6, entities };
            default:
                return { type: 'ambiguous', confidence: 0.5, entities };
        }
    }

    private classifyIntent(entities: ExtractedEntity[], text: string): InterpretedIntent['type'] {
        const lower = text.toLowerCase().trim();
        const greetings = ['hola', 'buen dia', 'buenas', 'hey', 'ola', 'alo', 'saludos', 'hola bot', 'holis'];
        if (greetings.includes(lower) || lower.length < 3) return 'unknown';

        const hasProduct = entities.some(e => e.type === 'product');
        const hasCategory = entities.some(e => e.type === 'category');
        const hasQuestion = /cuanto|precio|vale|tenes|hay|disponible|stock/i.test(text);
        const asksVarieties = /variedad|sabores|tipos|sabores|gustos|que hay de/i.test(text);
        const isGreeting = /^(hola|buenas|buen dia|que tal)/i.test(lower);

        if (hasCategory || (hasProduct && asksVarieties)) return 'category_inquiry';
        if (hasProduct && !hasQuestion) return 'direct_order';
        if (hasProduct && hasQuestion) return 'product_inquiry';
        if (isGreeting && !hasProduct) return 'greeting';
        
        return 'ambiguous';
    }

    private handleDirectOrder(entities: ExtractedEntity[], text: string): InterpretedIntent {
        const products = entities.filter(e => e.type === 'product');
        const quantities = entities.filter(e => e.type === 'quantity');

        const items: any[] = [];
        const processedProductIds = new Set<string>();

        // Sort products by position to handle them in order
        products.sort((a, b) => a.position[0] - b.position[0]);

        for (const product of products) {
            const productId = product.metadata.productId;
            
            // Check if this product was already matched recently in the same sentence
            // (e.g. "Pollo" followed by "Fritas" which both match "Pollo con Fritas")
            const isRedundant = items.some(item => 
                item.productId === productId && 
                (product.position[0] - (item._lastPos || 0) < 15)
            );
            
            if (isRedundant) continue;

            const quantity = quantities.find(q => {
                const distance = product.position[0] - q.position[1];
                return distance >= 0 && distance < 10;
            });

            const newItem = {
                productId,
                productName: product.normalizedValue,
                quantity: quantity ? parseFloat(quantity.normalizedValue) : 1,
                basePrice: product.metadata.basePrice,
                confidence: product.confidence * (quantity ? 1.0 : 0.8),
                _lastPos: product.position[1] // Tracking position for redundancy check
            };
            
            items.push(newItem);
        }

        return {
            type: 'direct_order',
            confidence: items.length > 0 ? Math.min(...items.map(i => i.confidence)) : 0,
            entities,
            parsedOrder: { items: items.map(({_lastPos, ...rest}) => rest) }
        };
    }
}
