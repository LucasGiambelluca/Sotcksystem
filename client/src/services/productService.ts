import { supabase } from '../supabaseClient';
import type { Product } from '../types';

export const productService = {
  async getAll() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true) // Filter active only
      .order('name');
    
    if (error) throw error;
    return data as Product[];
  },

  async create(product: Omit<Product, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();
    
    if (error) throw error;
    return data as Product;
  },

  async update(id: string, product: Partial<Omit<Product, 'id' | 'created_at'>>) {
    const { data, error } = await supabase
      .from('products')
      .update(product)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Product;
  },

  async delete(id: string) {
    // Soft delete
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id);
    
    if (error) throw error;
  },

  async updateStock(id: string, quantity: number) {
    // This is a simple update. For concurrency, we might want to use an RPC function in Supabase later.
    // But for now, getting the current stock and updating it is "okay" for a small app, 
    // though strictly speaking not atomic without a stored procedure or specific query.
    // A better approach for atomic updates:
    // rpc('decrement_stock', { row_id: id, quantity: quantity })
    
    // For this phase, we'll stick to simple updates or just assume the UI sends the new total.
    // Let's implement a fetch-then-update for safety if we just want to add/subtract.
    
    // Actually, let's just expose the update method which takes the new values. 
    // The logic for calculating the new stock will be in the UI or a higher level function for now.
    return this.update(id, { stock: quantity });
  }
};
