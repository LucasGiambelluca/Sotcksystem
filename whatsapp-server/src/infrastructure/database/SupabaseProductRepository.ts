import { SupabaseClient } from '@supabase/supabase-js';
import { IProductRepository, Product } from '../../domain/interfaces/IProductRepository';

export class SupabaseProductRepository implements IProductRepository {
    private db: SupabaseClient;

    constructor(db: SupabaseClient) {
        this.db = db;
    }

    async getById(id: string): Promise<Product | null> {
        const { data, error } = await this.db
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            console.error(`Error fetching product ${id}:`, error);
            return null;
        }

        return data as Product;
    }

    async getAll(filters?: { category?: string; search?: string }): Promise<Product[]> {
        let query = this.db.from('products').select('*');

        if (filters?.category) {
            query = query.ilike('category', `%${filters.category}%`);
        }
        if (filters?.search) {
            query = query.ilike('name', `%${filters.search}%`);
        }

        const { data, error } = await query;
        
        if (error) {
            console.error('Error fetching products:', error);
            return [];
        }

        return data as Product[];
    }

    async updateStock(id: string, newStock: number): Promise<void> {
        const { error } = await this.db
            .from('products')
            .update({ stock: Math.max(0, newStock) })
            .eq('id', id);

        if (error) {
            throw new Error(`Failed to update stock for product ${id}: ${error.message}`);
        }
    }
}
