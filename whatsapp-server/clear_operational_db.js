const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function resetOperationalDB() {
  console.log('🗑️  Limpiando datos transaccionales de la base de datos...');
  
  try {
    // 1. Borrar dependencias secundarias (Rutas e items)
    console.log('   - Borrando asignaciones de rutas...');
    await supabase.from('route_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('   - Borrando rutas...');
    await supabase.from('routes').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('   - Borrando tareas de estación...');
    await supabase.from('order_station_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('   - Borrando items de pedidos...');
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // 2. Borrar orders (padre)
    console.log('   - Borrando pedidos (orders)...');
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // 3. Borrar historial de bot y clientes
    console.log('   - Borrando sesiones del bot...');
    await supabase.from('flow_executions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('   - Borrando clientes...');
    await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('   - Borrando historial de stock...');
    await supabase.from('stock_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('✅ ¡Limpieza de pedidos y chats completada!');
    console.log('ℹ️  El catálogo, productos y estaciones se mantuvieron para que puedas probar.');
  } catch (error) {
    console.error('❌ Error al limpiar:', error.message);
  }
}

resetOperationalDB();
