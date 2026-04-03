import { supabase } from '../supabaseClient';
import type { Product, CatalogItem, CatalogCategory } from '../types';

export const productService = {
  async getAll() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true) // Filter out soft-deleted products
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
    // Soft delete to avoid breaking foreign keys (stock_movements, order_items)
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

// ─── Catalog Category Service ────────────────────────────────────────────────
export const catalogCategoryService = {
  async getAll() {
    const { data, error } = await supabase
      .from('catalog_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return data as CatalogCategory[];
  },

  async create(category: Omit<CatalogCategory, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('catalog_categories')
      .insert(category)
      .select()
      .single();
    if (error) throw error;
    return data as CatalogCategory;
  },

  async update(id: string, category: Partial<CatalogCategory>) {
    const { data, error } = await supabase
      .from('catalog_categories')
      .update({ ...category, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as CatalogCategory;
  },

  async updateAllOrders(items: { id: string; sort_order: number }[]) {
    for (const item of items) {
      await this.update(item.id, { sort_order: item.sort_order });
    }
  }
};

// ─── Catalog Item Service ─────────────────────────────────────────────────────
// Used by NewOrder and the order flow to get the finished/elaborated products available for sale.
// This queries catalog_items, NOT products (raw material inventory).

export const catalogItemService = {
  async getAll() {
    const { data, error } = await supabase
      .from('catalog_items')
      .select('*, catalog_category:catalog_categories(*)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    
    // Manual secondary sort by category order if needed, or we rely on the join
    // But better to use SQL ordering if possible.
    // Let's refine the order to be by category sort_order then item sort_order
    const { data: orderedData, error: orderError } = await supabase
      .from('catalog_items')
      .select('*, catalog_category!inner(*)')
      .eq('is_active', true)
      .order('sort_order', { foreignTable: 'catalog_categories', ascending: true })
      .order('sort_order', { ascending: true });

    if (!orderError && orderedData) return orderedData as CatalogItem[];

    return data as CatalogItem[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as CatalogItem;
  },

  async update(id: string, item: Partial<CatalogItem>) {
    const { data, error } = await supabase
      .from('catalog_items')
      .update({ ...item, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as CatalogItem;
  },

  async updateStock(id: string, newStock: number) {
    return this.update(id, { stock: newStock });
  },

  async updateAllOrders(items: { id: string; sort_order: number }[]) {
    // Using individual updates to be more robust with RLS and avoids upsert quirks
    for (const item of items) {
      const { error } = await supabase
        .from('catalog_items')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id);
      if (error) throw error;
    }
  }
};

// ─── Catalog Promotion Service ──────────────────────────────────────────────
export const catalogPromotionService = {
  async getAll(onlyActive = true) {
    let query = supabase
      .from('catalog_promotions')
      .select('*, catalog_item:catalog_items(*)')
      .order('sort_order', { ascending: true });
    
    if (onlyActive) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data as any[];
  },

  async create(promo: any) {
    const { data, error } = await supabase
      .from('catalog_promotions')
      .insert(promo)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, promo: any) {
    const { data, error } = await supabase
      .from('catalog_promotions')
      .update({ ...promo, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('catalog_promotions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
