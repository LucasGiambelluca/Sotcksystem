import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

export interface StockInfo {
    productId: string;
    quantity: number;
    lowStockThreshold: number;
    category?: string;
}

export interface Recommendation {
    productId: string;
    name: string;
    price: number;
    reason: string;
}

export class InventoryManager {
    private db: any;

    constructor(dbClient?: any) {
        this.db = dbClient || supabase;
    }

    /**
     * Checks availability for a list of items
     */
    async checkAvailability(items: { productId: string, quantity: number }[]): Promise<{
        available: boolean,
        issues: { productId: string, name: string, available: number, requested: number }[]
    }> {
        const issues = [];
        
        for (const item of items) {
            // In a real scenario, we'd use a single query for all IDs
            const { data: product, error } = await this.db
                .from('products')
                .select('name, stock')
                .eq('id', item.productId)
                .single();

            if (error || !product) continue;

            if ((product.stock || 0) < item.quantity) {
                issues.push({
                    productId: item.productId,
                    name: product.name,
                    available: product.stock || 0,
                    requested: item.quantity
                });
            }
        }

        return {
            available: issues.length === 0,
            issues
        };
    }

    /**
     * Finds alternatives for a product based on category
     */
    async findAlternatives(productId: string, limit = 3): Promise<Recommendation[]> {
        try {
            // 1. Get original product category
            const { data: original } = await this.db
                .from('products')
                .select('category')
                .eq('id', productId)
                .single();

            if (!original || !original.category) return [];

            // 2. Find other products in same category with stock
            const { data: alternatives } = await this.db
                .from('products')
                .select('id, name, price')
                .eq('category', original.category)
                .neq('id', productId)
                .gt('stock', 0)
                .limit(limit);

            return (alternatives || []).map(a => ({
                productId: a.id,
                name: a.name,
                price: a.price,
                reason: `Similar a lo que buscabas (${original.category})`
            }));
        } catch (err) {
            logger.error(`[Inventory] Error finding alternatives`, { productId, err });
            return [];
        }
    }

    /**
     * Temporarily reserve stock (Soft Reservation)
     * In this implementation, we just log it or update a tentative field.
     * Real implementation would use a 'reservations' table with TTL.
     */
    async reserveStock(sessionId: string, items: { productId: string, quantity: number }[]): Promise<boolean> {
        // Implementation for soft reservations goes here
        // For now, we assume it's successful if stock is checked
        return true;
    }
}

export const inventoryManager = new InventoryManager();
