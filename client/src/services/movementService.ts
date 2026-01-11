import { supabase } from '../supabaseClient';
import type { Movement } from '../types';

export const movementService = {
  async getByClient(clientId: string) {
    const { data, error } = await supabase
      .from('movements')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Movement[];
  },

  async create(movement: Omit<Movement, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('movements')
      .insert(movement)
      .select()
      .single();
    
    if (error) throw error;
    return data as Movement;
  },

  async update(id: string, movement: Partial<Omit<Movement, 'id' | 'created_at'>>) {
    const { data, error } = await supabase
      .from('movements')
      .update(movement)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Movement;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('movements')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async getClientBalance(clientId: string) {
    const { data, error } = await supabase
      .from('movements')
      .select('type, amount')
      .eq('client_id', clientId);
    
    if (error) throw error;

    const balance = data.reduce((acc, curr) => {
      if (curr.type === 'DEBT') return acc + curr.amount;
      if (curr.type === 'PAYMENT') return acc - curr.amount;
      return acc;
    }, 0);

    return balance;
  },

  async getBalancesForClients(clientIds: string[]) {
    if (clientIds.length === 0) return {};

    const { data, error } = await supabase
      .from('movements')
      .select('client_id, type, amount')
      .in('client_id', clientIds);
    
    if (error) throw error;

    const balances: Record<string, number> = {};

    // Initialize balances for all requested clients to 0
    clientIds.forEach(id => balances[id] = 0);

    data.forEach(movement => {
      if (movement.type === 'DEBT') {
        balances[movement.client_id] += movement.amount;
      } else if (movement.type === 'PAYMENT') {
        balances[movement.client_id] -= movement.amount;
      }
    });

    return balances;
  }
};
