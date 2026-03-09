import { supabase } from '../supabaseClient';
import type { Station } from '../types';

export const stationService = {
  async getAll(): Promise<Station[]> {
    const { data, error } = await supabase
      .from('stations')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data as Station[];
  },

  async create(station: Omit<Station, 'id' | 'created_at'>): Promise<Station> {
    const { data, error } = await supabase
      .from('stations')
      .insert(station)
      .select()
      .single();
    if (error) throw error;
    return data as Station;
  },

  async update(id: string, updates: Partial<Omit<Station, 'id' | 'created_at'>>): Promise<Station> {
    const { data, error } = await supabase
      .from('stations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Station;
  },

  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('stations')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
  }
};
