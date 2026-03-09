import { supabase } from '../supabaseClient';
import type { Employee } from '../types';

export const employeeService = {
  async getAll(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data as Employee[];
  },

  async create(employee: Omit<Employee, 'id' | 'created_at'>): Promise<Employee> {
    const { data, error } = await supabase
      .from('employees')
      .insert(employee)
      .select()
      .single();
    if (error) throw error;
    return data as Employee;
  },

  async update(id: string, updates: Partial<Omit<Employee, 'id' | 'created_at'>>): Promise<Employee> {
    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Employee;
  },

  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
  }
};
