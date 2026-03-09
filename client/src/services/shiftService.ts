import { supabase } from '../supabaseClient';
import type { Shift } from '../types';

export const shiftService = {
  async startShift(employeeId: string, stationId: string): Promise<Shift> {
    const { data, error } = await supabase
      .from('shifts')
      .insert({
        employee_id: employeeId,
        station_id: stationId,
        status: 'ACTIVE',
      })
      .select(`
        *,
        employee:employees(*),
        station:stations(*)
      `)
      .single();
    if (error) throw error;
    return data as Shift;
  },

  async endShift(shiftId: string, notes?: string): Promise<Shift> {
    const { data, error } = await supabase
      .from('shifts')
      .update({
        end_time: new Date().toISOString(),
        status: 'CLOSED',
        notes: notes || null,
      })
      .eq('id', shiftId)
      .select(`
        *,
        employee:employees(*),
        station:stations(*)
      `)
      .single();
    if (error) throw error;
    return data as Shift;
  },

  async getActiveShifts(): Promise<Shift[]> {
    const { data, error } = await supabase
      .from('shifts')
      .select(`
        *,
        employee:employees(*),
        station:stations(*)
      `)
      .eq('status', 'ACTIVE')
      .order('start_time', { ascending: false });
    if (error) throw error;
    return data as Shift[];
  },

  async getShiftsByDate(date: string): Promise<Shift[]> {
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;
    const { data, error } = await supabase
      .from('shifts')
      .select(`
        *,
        employee:employees(*),
        station:stations(*)
      `)
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)
      .order('start_time', { ascending: false });
    if (error) throw error;
    return data as Shift[];
  },

  async getActiveShiftForStation(stationId: string): Promise<Shift | null> {
    const { data, error } = await supabase
      .from('shifts')
      .select(`
        *,
        employee:employees(*),
        station:stations(*)
      `)
      .eq('station_id', stationId)
      .eq('status', 'ACTIVE')
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as Shift | null;
  }
};
