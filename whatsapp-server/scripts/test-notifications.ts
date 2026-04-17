/**
 * Script de diagnóstico para probar el sistema de notificaciones
 * Permite cambiar estados de órdenes manualmente y verificar si se disparan notificaciones
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

async function testNotifications() {
  console.log('=== DIAGNÓSTICO DE NOTIFICACIONES ===\n');

  // 1. Verificar órdenes activas
  console.log('1. Buscando órdenes activas...');
  const { data: activeOrders, error } = await supabase
    .from('orders')
    .select('id, order_number, status, created_at, chat_context, phone')
    .in('status', ['PENDING', 'CONFIRMED', 'IN_PREPARATION'])
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!activeOrders || activeOrders.length === 0) {
    console.log('No hay órdenes activas para probar.\n');
    return;
  }

  console.log(`Encontradas ${activeOrders.length} órdenes activas:\n`);
  activeOrders.forEach((o, i) => {
    const botId = o.chat_context?.bot_id || 'N/A';
    console.log(`[${i + 1}] Orden #${o.order_number} - Estado: ${o.status} - Bot: ${botId}`);
    console.log(`    ID: ${o.id}`);
    console.log(`    Tel: ${o.phone || 'N/A'}`);
    console.log('');
  });

  // 2. Intentar actualizar el estado de la primera orden
  const testOrder = activeOrders[0];
  const newStatus = testOrder.status === 'PENDING' ? 'CONFIRMED' :
                    testOrder.status === 'CONFIRMED' ? 'IN_PREPARATION' :
                    testOrder.status === 'IN_PREPARATION' ? 'READY_FOR_PICKUP' : 'DELIVERED';

  console.log(`2. Actualizando orden #${testOrder.order_number} de ${testOrder.status} a ${newStatus}...`);

  try {
    // Intentar actualizar usando el método estándar
    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', testOrder.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error al actualizar:', updateError.message);
      console.log('\n⚠️ ESTE ES EL PROBLEMA: El trigger en la base de datos intenta actualizar');
      console.log('   "updated_at" pero la columna no existe.\n');
      console.log('SOLUCIÓN: Ejecuta el SQL en fix_updated_at.sql en el dashboard de Supabase.');
      return;
    }

    console.log('✅ Orden actualizada correctamente:');
    console.log(`   Nuevo estado: ${updated.status}`);
    console.log(`   Orden: #${updated.order_number}`);
    console.log('\nSi el sistema de notificaciones está corriendo, debería haber');
    console.log('enviado un mensaje al teléfono del cliente.');

  } catch (err: any) {
    console.error('❌ Error inesperado:', err.message);
  }
}

// Ejecutar
console.log('');
testNotifications();
