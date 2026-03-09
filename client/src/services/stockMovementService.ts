import { supabase } from '../supabaseClient';
import type { StockMovement } from '../types';

export const stockMovementService = {
  /**
   * Registers a stock movement and updates the corresponding product balances in a single transaction-like context.
   * Since we are directly calling Supabase from the client, we do the balance calculations in the UI and save them.
   */
  async registerPurchase(productId: string, quantity: number, description: string, currentWarehouseStock: number, shiftId?: string, employeeId?: string) {
    // 1. Update Product: increase warehouse stock
    const newStock = currentWarehouseStock + quantity;
    const { error: productError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', productId);
    
    if (productError) throw productError;

    // 2. Register Movement
    return this.createMovement({
      product_id: productId,
      type: 'PURCHASE',
      quantity: quantity,
      description: description,
      shift_id: shiftId || null,
      employee_id: employeeId || null,
    });
  },

  async transferToProduction(productId: string, quantity: number, description: string, currentWarehouseStock: number, currentProductionStock: number, shiftId?: string, employeeId?: string) {
    if (currentWarehouseStock < quantity) {
        throw new Error('Not enough stock in warehouse to transfer.');
    }

    // 1. Update Product: decrease warehouse, increase production
    const newWarehouseStock = currentWarehouseStock - quantity;
    const newProductionStock = currentProductionStock + quantity;
    
    const { error: productError } = await supabase
      .from('products')
      .update({ 
        stock: newWarehouseStock,
        production_stock: newProductionStock
      })
      .eq('id', productId);
    
    if (productError) throw productError;

    // 2. Register Movement
    return this.createMovement({
      product_id: productId,
      type: 'TRANSFER',
      quantity: quantity,
      description: description,
      shift_id: shiftId || null,
      employee_id: employeeId || null,
    });
  },

  async createMovement(movement: Omit<StockMovement, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('stock_movements')
      .insert(movement)
      .select()
      .single();
    
    if (error) throw error;
    return data as StockMovement;
  },

  async getMovementsByProduct(productId: string) {
    const { data, error } = await supabase
      .from('stock_movements')
      .select(`
        *,
        employee:employees(name)
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data;
  },

  async getAllMovements(startDate?: string, endDate?: string) {
    let query = supabase
      .from('stock_movements')
      .select(`
        *,
        product:products(name, category),
        employee:employees(name)
      `)
      .order('created_at', { ascending: false });

    if (startDate) {
        query = query.gte('created_at', startDate);
    }
    if (endDate) {
        query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
};
