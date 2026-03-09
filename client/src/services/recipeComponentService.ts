import { supabase } from '../supabaseClient';
import type { RecipeComponent } from '../types';

export const recipeComponentService = {
  async getByItem(catalogItemId: string): Promise<RecipeComponent[]> {
    const { data, error } = await supabase
      .from('recipe_components')
      .select('*, station:stations(*)')
      .eq('catalog_item_id', catalogItemId)
      .order('sort_order');
    if (error) throw error;
    return data as RecipeComponent[];
  },

  async create(component: Omit<RecipeComponent, 'id' | 'created_at' | 'station'>): Promise<RecipeComponent> {
    const { data, error } = await supabase
      .from('recipe_components')
      .insert(component)
      .select('*, station:stations(*)')
      .single();
    if (error) throw error;
    return data as RecipeComponent;
  },

  async update(id: string, updates: Partial<Omit<RecipeComponent, 'id' | 'created_at' | 'station'>>): Promise<RecipeComponent> {
    const { data, error } = await supabase
      .from('recipe_components')
      .update(updates)
      .eq('id', id)
      .select('*, station:stations(*)')
      .single();
    if (error) throw error;
    return data as RecipeComponent;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('recipe_components')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
