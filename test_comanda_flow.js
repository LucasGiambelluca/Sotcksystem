/**
 * TEST COMPLETO DEL FLUJO DE COMANDAS POR ESTACIONES
 * ===================================================
 * Simula un pedido real y verifica que las tareas se generen
 * correctamente en cada estación de cocina.
 * 
 * Uso: node test_comanda_flow.js
 */

const path = require('path');
// Load dotenv from root
require(path.join(__dirname, 'whatsapp-server', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '.env') });
const { createClient } = require(path.join(__dirname, 'whatsapp-server', 'node_modules', '@supabase', 'supabase-js'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── HELPERS ────────────────────────────────────────────────────────────────
const ok  = (msg) => console.log(`  ✅ ${msg}`);
const err = (msg) => console.log(`  ❌ ${msg}`);
const info = (msg) => console.log(`  ℹ️  ${msg}`);
const sep = (title) => console.log(`\n${'─'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}`);

let PASS = 0;
let FAIL = 0;

function assert(condition, message) {
  if (condition) { ok(message); PASS++; }
  else           { err(message); FAIL++; }
}

// IDs creados durante el test (para limpieza al final)
const created = { orderId: null, clientId: null, stationIds: [], catalogItemId: null, tempClientPhone: null };

// ── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🍽️  INICIANDO TESTS DE FLUJO DE COMANDAS\n');
  console.log(`📡 Supabase: ${SUPABASE_URL}`);

  try {
    await testInfrastructure();
    await testStationsExist();
    await testCatalogItemWithStation();
    await testCreateOrder();
    await testOrderConfirmation();
    await testStationTasksGenerated();
    await testStationTaskTransitions();
    await testOrderAutoCompletion();
  } catch (e) {
    console.error('\n💥 Test aborted with unhandled error:', e.message);
    FAIL++;
  } finally {
    await cleanup();
    printSummary();
  }
}

// ── TEST 1: INFRAESTRUCTURA ────────────────────────────────────────────────
async function testInfrastructure() {
  sep('TEST 1 — Infraestructura de tablas');

  const tables = ['stations', 'catalog_items', 'recipe_components', 'order_station_tasks', 'orders', 'clients'];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    assert(!error, `Tabla "${table}" existe y es accesible`);
    if (error) info(`Error: ${error.message}`);
  }
}

// ── TEST 2: ESTACIONES ────────────────────────────────────────────────────
async function testStationsExist() {
  sep('TEST 2 — Estaciones de trabajo');

  const { data: stations, error } = await supabase
    .from('stations')
    .select('id, name, color, is_active')
    .eq('is_active', true);

  assert(!error, 'Consulta de estaciones sin error');
  if (error) { info(`Error: ${error.message}`); return; }

  assert(stations && stations.length > 0, `Al menos 1 estación activa (encontradas: ${stations?.length || 0})`);

  if (stations && stations.length > 0) {
    console.log('\n  📋 Estaciones encontradas:');
    stations.forEach(s => {
      console.log(`     🏭 ${s.name} (${s.color}) — id: ${s.id}`);
      created.stationIds.push(s.id);
    });
  }
}

// ── TEST 3: CATÁLOGO CON ESTACIÓN ────────────────────────────────────────
async function testCatalogItemWithStation() {
  sep('TEST 3 — Catalog item con estación asignada');

  // Buscar un catalog_item que ya tenga station_id
  const { data: items, error } = await supabase
    .from('catalog_items')
    .select('id, name, price, station_id, stations(name)')
    .not('station_id', 'is', null)
    .limit(5);

  if (error) {
    info(`Error buscando catalog_items: ${error.message}`);
    FAIL++;
  }

  if (items && items.length > 0) {
    assert(true, `Catalog items con estación asignada: ${items.length}`);
    console.log('\n  📦 Items con estación:');
    items.forEach(i => {
      console.log(`     • ${i.name} → Estación: ${i.stations?.name || i.station_id}`);
    });
    created.catalogItemId = items[0].id;
    created.catalogItemPrice = items[0].price;
    created.catalogItemName = items[0].name;
  } else {
    // Si no hay catalog_items con station, crear uno temporal
    info('No hay catalog_items con estación. Intentando crear uno de prueba...');
    
    if (created.stationIds.length === 0) {
      info('No hay estaciones disponibles. Saltando paso.');
      return;
    }

    // Buscar cualquier catalog_item activo
    const { data: anyItem } = await supabase
      .from('catalog_items')
      .select('id, name, price')
      .limit(1)
      .single();

    if (anyItem) {
      // Asignarle la primera estación
      const { error: updateError } = await supabase
        .from('catalog_items')
        .update({ station_id: created.stationIds[0] })
        .eq('id', anyItem.id);

      assert(!updateError, `Asignación de estación a "${anyItem.name}"`);
      if (!updateError) {
        created.catalogItemId = anyItem.id;
        created.catalogItemPrice = anyItem.price;
        created.catalogItemName = anyItem.name;
        info(`Estación asignada a: "${anyItem.name}"`);
      }
    } else {
      info('No hay catalog_items disponibles. Crea productos en el panel primero.');
    }
  }

  // Verificar recipe_components
  const { data: components, error: rcError } = await supabase
    .from('recipe_components')
    .select('id, name, station_id, stations(name), catalog_items(name)')
    .limit(10);

  if (!rcError && components) {
    assert(true, `recipe_components consultados OK`);
    if (components.length > 0) {
      console.log('\n  🧩 Recipe components (componentes de estación):');
      components.forEach(c => {
        console.log(`     • ${c.catalog_items?.name || '?'} → "${c.name}" en ${c.stations?.name || 'sin estación'}`);
      });
    } else {
      info('No hay recipe_components todavía (se usará fallback por station_id del catalog_item)');
    }
  }
}

// ── TEST 4: CREAR PEDIDO ──────────────────────────────────────────────────
async function testCreateOrder() {
  sep('TEST 4 — Crear nuevo pedido (status PENDING)');

  // Usar un teléfono de prueba único
  const testPhone = `+5491155550${Date.now().toString().slice(-4)}`;
  created.tempClientPhone = testPhone;

  // Crear o buscar cliente
  let { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('phone', testPhone)
    .maybeSingle();

  if (!client) {
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({ phone: testPhone, name: 'Cliente Test Comanda' })
      .select()
      .single();

    assert(!clientError, `Cliente de prueba creado (${testPhone})`);
    if (clientError) { info(clientError.message); return; }
    client = newClient;
  } else {
    ok(`Cliente existente reutilizado (${testPhone})`);
  }
  created.clientId = client.id;

  if (!created.catalogItemId) {
    info('Sin catalog_item disponible, saltando creación de pedido...');
    return;
  }

  // Crear el pedido en estado PENDING
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      client_id: client.id,
      phone: testPhone,
      channel: 'WHATSAPP',
      status: 'PENDING',
      total_amount: created.catalogItemPrice || 1000,
      subtotal: created.catalogItemPrice || 1000,
      chat_context: { test: true, source: 'test_comanda_flow.js' }
    })
    .select()
    .single();

  assert(!orderError, 'Pedido creado en estado PENDING');
  if (orderError) { info(orderError.message); return; }
  created.orderId = order.id;
  info(`Order ID: ${order.id}`);

  // Buscar un product_id válido para sortear el constraint NOT NULL antiguo
  const { data: randProduct } = await supabase.from('products').select('id').limit(1).single();
  const fallbackProductId = randProduct ? randProduct.id : null;

  // Crear los items del pedido (usando catalog_item_id, no product_id)
  const { error: itemsError } = await supabase
    .from('order_items')
    .insert({
      order_id: order.id,
      catalog_item_id: created.catalogItemId,
      product_id: fallbackProductId, // Necesario hasta que se elimine el constraint NOT NULL
      quantity: 2,
      unit_price: created.catalogItemPrice || 1000
    });

  assert(!itemsError, `Order item creado: 2x "${created.catalogItemName}"`);
  if (itemsError) info(itemsError.message);

  // Verificar que NO se generaron tareas aún (orden está PENDING)
  const { data: tasks } = await supabase
    .from('order_station_tasks')
    .select('id')
    .eq('order_id', order.id);

  assert(!tasks || tasks.length === 0, 'No se generaron tareas en estado PENDING (correcto)');
}

// ── TEST 5: CONFIRMAR PEDIDO ──────────────────────────────────────────────
async function testOrderConfirmation() {
  sep('TEST 5 — Confirmar pedido (trigger debe generar comandas)');

  if (!created.orderId) {
    info('Sin order_id disponible, saltando...');
    FAIL++;
    return;
  }

  const { data: updated, error } = await supabase
    .from('orders')
    .update({ status: 'CONFIRMED' })
    .eq('id', created.orderId)
    .select()
    .single();

  assert(!error, 'Pedido actualizado a CONFIRMED');
  if (error) { info(error.message); return; }
  assert(updated.status === 'CONFIRMED', `Status correcto: ${updated.status}`);
  info(`Orden ${created.orderId} → CONFIRMED ✓`);
}

// ── TEST 6: VERIFICAR TAREAS POR ESTACIÓN ────────────────────────────────
async function testStationTasksGenerated() {
  sep('TEST 6 — Verificar generación de order_station_tasks');

  if (!created.orderId) {
    info('Sin order_id disponible, saltando...');
    FAIL++;
    return;
  }

  // Esperar un poco en caso de trigger asíncrono
  await new Promise(r => setTimeout(r, 1000));

  const { data: tasks, error } = await supabase
    .from('order_station_tasks')
    .select('id, status, items, station_id, stations(name, color)')
    .eq('order_id', created.orderId);

  assert(!error, 'Consulta de order_station_tasks sin error');
  if (error) { info(error.message); return; }

  assert(tasks && tasks.length > 0, `Se generaron ${tasks?.length || 0} tarea(s) de estación`);

  if (tasks && tasks.length > 0) {
    console.log('\n  📋 Tareas generadas:');
    tasks.forEach(t => {
      const stationName = t.stations?.name || 'Desconocida';
      const itemCount = Array.isArray(t.items) ? t.items.length : '?';
      console.log(`\n     🏭 ESTACIÓN: ${stationName} (${t.stations?.color || '#ccc'})`);
      console.log(`        Status: ${t.status}`);
      console.log(`        Items (${itemCount}):`);
      if (Array.isArray(t.items)) {
        t.items.forEach(i => {
          console.log(`          → ${i.quantity}x ${i.name}${i.parent_item ? ` (de: ${i.parent_item})` : ''}`);
        });
      }
    });

    // Verificar que cada tarea empieza en 'pending'
    const allPending = tasks.every(t => t.status === 'pending');
    assert(allPending, 'Todas las tareas inician en estado "pending"');

    // Verificar que los items tienen la estructura correcta
    const hasValidItems = tasks.every(t => Array.isArray(t.items) && t.items.length > 0);
    assert(hasValidItems, 'Todas las tareas tienen items válidos');
  } else {
    info('⚠️  No se generaron tareas. Posibles causas:');
    info('    - El trigger "trg_generate_station_tasks" no está aplicado en la DB');
    info('    - El catalog_item del pedido no tiene station_id ni recipe_components');
    info('    → Solución: Aplica la migración 20260305_recipe_components_and_tasks.sql');
  }
}

// ── TEST 7: TRANSICIONES DE ESTADOS ──────────────────────────────────────
async function testStationTaskTransitions() {
  sep('TEST 7 — Transiciones de estado en estaciones (pending → preparing → ready)');

  if (!created.orderId) {
    info('Sin order_id disponible, saltando...');
    return;
  }

  const { data: tasks } = await supabase
    .from('order_station_tasks')
    .select('id, status')
    .eq('order_id', created.orderId);

  if (!tasks || tasks.length === 0) {
    info('Sin tareas para transicionar, saltando...');
    return;
  }

  const task = tasks[0];
  created.taskId = task.id;

  // PENDING → PREPARING
  const { error: prepError } = await supabase
    .from('order_station_tasks')
    .update({ status: 'preparing' })
    .eq('id', task.id);

  assert(!prepError, 'Tarea: pending → preparing');
  if (prepError) info(prepError.message);

  // Verificar que el pedido pasó a IN_PREPARATION
  await new Promise(r => setTimeout(r, 500));
  const { data: orderMid } = await supabase
    .from('orders')
    .select('status')
    .eq('id', created.orderId)
    .single();

  info(`Estado del pedido tras comenzar preparación: ${orderMid?.status}`);
  assert(
    orderMid?.status === 'IN_PREPARATION' || orderMid?.status === 'CONFIRMED',
    `Pedido en estado válido durante preparación: ${orderMid?.status}`
  );

  // PREPARING → READY
  const { error: readyError } = await supabase
    .from('order_station_tasks')
    .update({ status: 'ready' })
    .eq('id', task.id);

  assert(!readyError, 'Tarea: preparing → ready');
  if (readyError) info(readyError.message);
}

// ── TEST 8: AUTO-COMPLETION DEL PEDIDO ───────────────────────────────────
async function testOrderAutoCompletion() {
  sep('TEST 8 — Auto-completar pedido cuando TODAS las estaciones están listas');

  if (!created.orderId) {
    info('Sin order_id disponible, saltando...');
    return;
  }

  const { data: tasks } = await supabase
    .from('order_station_tasks')
    .select('id, status')
    .eq('order_id', created.orderId);

  if (!tasks || tasks.length === 0) {
    info('Sin tareas, saltando...');
    return;
  }

  // Marcar TODAS las tareas pendientes como ready
  const pendingTasks = tasks.filter(t => t.status !== 'ready');
  for (const t of pendingTasks) {
    // Primero a preparing (si está en pending)
    if (t.status === 'pending') {
      await supabase.from('order_station_tasks').update({ status: 'preparing' }).eq('id', t.id);
    }
    const { error } = await supabase
      .from('order_station_tasks')
      .update({ status: 'ready' })
      .eq('id', t.id);
    if (error) info(`Error en tarea ${t.id}: ${error.message}`);
  }

  await new Promise(r => setTimeout(r, 800));

  // Verificar estado final del pedido
  const { data: finalOrder } = await supabase
    .from('orders')
    .select('status')
    .eq('id', created.orderId)
    .single();

  info(`Estado final del pedido: ${finalOrder?.status}`);
  assert(
    finalOrder?.status === 'DELIVERED' || finalOrder?.status === 'READY',
    `Pedido auto-completado: ${finalOrder?.status} (esperado: DELIVERED o READY)`
  );

  // Verificar que todas las tareas están ready
  const { data: finalTasks } = await supabase
    .from('order_station_tasks')
    .select('id, status')
    .eq('order_id', created.orderId);

  const allReady = finalTasks?.every(t => t.status === 'ready');
  assert(allReady, `Todas las tareas en estado "ready" (${finalTasks?.length} tareas)`);
}

// ── CLEANUP ──────────────────────────────────────────────────────────────
async function cleanup() {
  sep('LIMPIEZA — Eliminando datos de prueba');

  if (created.orderId) {
    // order_station_tasks se eliminan en CASCADE
    const { error } = await supabase.from('orders').delete().eq('id', created.orderId);
    if (!error) ok(`Pedido de prueba eliminado: ${created.orderId}`);
    else info(`Error eliminando pedido: ${error.message}`);
  }

  if (created.clientId) {
    const { error } = await supabase.from('clients').delete().eq('id', created.clientId);
    if (!error) ok(`Cliente de prueba eliminado: ${created.tempClientPhone}`);
    else info(`Error eliminando cliente: ${error.message}`);
  }
}

// ── RESUMEN FINAL ────────────────────────────────────────────────────────
function printSummary() {
  const total = PASS + FAIL;
  console.log('\n' + '═'.repeat(60));
  console.log('  RESUMEN FINAL');
  console.log('═'.repeat(60));
  console.log(`  ✅ Tests pasados: ${PASS}/${total}`);
  console.log(`  ❌ Tests fallados: ${FAIL}/${total}`);
  if (FAIL === 0) {
    console.log('\n  🎉 ¡TODO EL FLUJO DE COMANDAS FUNCIONA CORRECTAMENTE!');
  } else {
    console.log('\n  ⚠️  Hay problemas que necesitan atención.');
    console.log('  Revisa los ❌ arriba para diagnóstico detallado.');
  }
  console.log('═'.repeat(60) + '\n');
  process.exit(FAIL > 0 ? 1 : 0);
}

main();
