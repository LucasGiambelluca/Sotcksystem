import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntityExtractor } from '../EntityExtractor';
import { OrderInterpreter } from '../OrderInterpreter';

describe('NLU Engine - Order Interpretation', () => {
    let extractor: EntityExtractor;
    let interpreter: OrderInterpreter;

    const mockProducts = [
        { id: 'p1', name: 'Pollo con Papas', synonyms: ['pollo', 'papas'], base_price: 1500, category: 'Pollo' },
        { id: 'p2', name: 'Hamburguesa Triple', synonyms: ['hamburguesa', 'burger'], base_price: 1200, category: 'Hamburguesas' },
        { id: 'p3', name: 'Coca Cola', synonyms: ['coca', 'gaseosa'], base_price: 500, category: 'Bebidas' }
    ];

    const mockDb = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockProducts, error: null })
    };

    beforeEach(async () => {
        extractor = new EntityExtractor(mockDb);
        await extractor.loadCatalog();
        interpreter = new OrderInterpreter(extractor);
    });

    it('should extract product and quantity from "quiero 2 pollos"', async () => {
        const result = await interpreter.interpret('quiero 2 pollos');
        expect(result.type).toBe('direct_order');
        expect(result.parsedOrder?.items).toHaveLength(1);
        expect(result.parsedOrder?.items[0]).toMatchObject({
            productName: 'Pollo con Papas',
            quantity: 2
        });
    });

    it('should handle fuzzy matching for "amburguesa"', async () => {
        const result = await interpreter.interpret('una amburguesa');
        expect(result.parsedOrder?.items[0].productName).toBe('Hamburguesa Triple');
    });

    it('should identify a product inquiry', async () => {
        const result = await interpreter.interpret('cuanto sale el pollo?');
        expect(result.type).toBe('product_inquiry');
    });

    it('should identify a greeting', async () => {
        const result = await interpreter.interpret('Hola!');
        expect(result.type).toBe('greeting');
    });
});
