import { EntityExtractor, ExtractedEntity } from './EntityExtractor';
import { logger } from '../../utils/logger';

export interface InterpretedIntent {
    type: 'direct_order' | 'product_inquiry' | 'greeting' | 'ambiguous';
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
        const entities = this.extractor.extract(text);
        
        // 1. Basic Intent Classification
        const intentType = this.classifyIntent(entities, text);
        
        // 2. Intent Handling
        switch (intentType) {
            case 'direct_order':
                return this.handleDirectOrder(entities, text);
            case 'product_inquiry':
                return { type: 'product_inquiry', confidence: 0.85, entities };
            case 'greeting':
                return { type: 'greeting', confidence: 0.9, entities };
            default:
                return { type: 'ambiguous', confidence: 0.5, entities };
        }
    }

    private classifyIntent(entities: ExtractedEntity[], rawText: string): InterpretedIntent['type'] {
        const hasProducts = entities.some(e => e.type === 'product');
        const hasQuestion = /cuanto|precio|vale|tenes|hay|disponible/i.test(rawText);
        const isGreeting = /^(hola|buenas|buen dia|que tal)/i.test(rawText.toLowerCase().trim());

        if (hasProducts && !hasQuestion) return 'direct_order';
        if (hasProducts && hasQuestion) return 'product_inquiry';
        if (isGreeting && !hasProducts) return 'greeting';
        
        return 'ambiguous';
    }

    private handleDirectOrder(entities: ExtractedEntity[], text: string): InterpretedIntent {
        const products = entities.filter(e => e.type === 'product');
        const quantities = entities.filter(e => e.type === 'quantity');

        const items = products.map(product => {
            // Find closest quantity before the product
            const quantity = quantities.find(q => {
                const distance = product.position[0] - q.position[1];
                return distance >= 0 && distance < 10;
            });

            return {
                productId: product.metadata.productId,
                productName: product.normalizedValue,
                quantity: quantity ? parseFloat(quantity.normalizedValue) : 1,
                basePrice: product.metadata.basePrice,
                confidence: product.confidence * (quantity ? 1.0 : 0.8)
            };
        });

        return {
            type: 'direct_order',
            confidence: items.length > 0 ? Math.min(...items.map(i => i.confidence)) : 0,
            entities,
            parsedOrder: { items }
        };
    }
}
