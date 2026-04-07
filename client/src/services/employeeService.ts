import { supabase } from '../supabaseClient';
import type { Employee } from '../types';

export const employeeService = {
  async getAll(includeInactive = false): Promise<Employee[]> {
    let query = supabase
      .from('employees')
      .select('*')
      .order('name');
    
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Employee[];
  },

  async delete(id: string): Promise<void> {
    // 1. Get assignments to find assignment_orders
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id')
      .eq('cadete_id', id);
    
    const assignmentIds = assignments?.map(a => a.id) || [];

    // 2. Delete related records in sequence to satisfy FKs
    if (assignmentIds.length > 0) {
      await supabase.from('assignment_orders').delete().in('assignment_id', assignmentIds);
      await supabase.from('assignments').delete().in('id', assignmentIds);
    }

    // 3. Delete metadata, locations, and shifts
    await Promise.all([
      supabase.from('cadete_metadata').delete().eq('employee_id', id),
      supabase.from('cadete_locations').delete().eq('employee_id', id),
      supabase.from('shifts').delete().eq('employee_id', id),
      // Set assigned_to to null in orders to avoid breaking history
      supabase.from('orders').update({ assigned_to: null }).eq('assigned_to', id)
    ]);

    // 4. Finally delete the employee
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
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
