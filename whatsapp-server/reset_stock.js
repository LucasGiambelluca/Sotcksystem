const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function resetStock() {
  console.log('📦 Limpiando stock de productos e historial...');
  
  try {
    // 1. Borrar tabla de movimientos
    console.log('   - Borrando movimientos de stock...');
    const { error: moveError } = await supabase.from('stock_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (moveError) throw moveError;

    // 2. Setear a 0 todos los stocks en products
    console.log('   - Reiniciando stock en productos a 0...');
    const { error: prodError } = await supabase.from('products').update({ stock: 0, production_stock: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (prodError) throw prodError;

    console.log('✅ ¡Inventario y Reportes de Stock restablecidos a cero!');
  } catch (error) {
    console.error('❌ Error al resetear stock:', error.message);
  }
}

resetStock();
