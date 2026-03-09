import { SupabaseClient } from '@supabase/supabase-js';
import { IProductRepository, Product } from '../../domain/interfaces/IProductRepository';

/**
 * IMPORTANT: This repository now queries `catalog_items` table, NOT `products`.
 * 
 * - `products` = raw material inventory (flour, chicken, etc.) — managed internally
 * - `catalog_items` = finished/elaborated products available for sale (pizza, grilled chicken, etc.)
 * 
 * The WhatsApp bot and public catalog use ONLY catalog_items.
 */
export class SupabaseProductRepository implements IProductRepository {
    private db: SupabaseClient;

    constructor(db: SupabaseClient) {
        this.db = db;
    }

    async getById(id: string): Promise<Product | null> {
        const { data, error } = await this.db
            .from('catalog_items')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            console.error(`Error fetching catalog_item ${id}:`, error);
            return null;
        }

        return data as Product;
    }

    async getAll(filters?: { category?: string; search?: string }): Promise<Product[]> {
        let query = this.db
            .from('catalog_items')
            .select('*')
            .eq('is_active', true); // Only return active catalog items to the bot

        if (filters?.category) {
            query = query.ilike('category', `%${filters.category}%`);
        }
        if (filters?.search) {
            query = query.ilike('name', `%${filters.search}%`);
        }

        const { data, error } = await query;
        
        if (error) {
            console.error('Error fetching catalog_items:', error);
            return [];
        }

        return data as Product[];
    }

    async updateStock(id: string, newStock: number): Promise<void> {
        const { error } = await this.db
            .from('catalog_items')
            .update({ stock: Math.max(0, newStock), updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            throw new Error(`Failed to update stock for catalog_item ${id}: ${error.message}`);
        }
    }
}
