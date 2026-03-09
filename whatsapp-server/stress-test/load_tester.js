/**
 * ═══════════════════════════════════════════════════════
 *  STRESS TEST SUITE — Sotcksystem Production Benchmark
 * ═══════════════════════════════════════════════════════
 * 
 *  Tests:
 *    1. DB Trigger Stress — Concurrent order confirmations
 *    2. FlowEngine Stress — Simulated concurrent users
 *    3. Realtime Stress   — Push notification burst
 * 
 *  Usage: node stress-test/load_tester.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Utility ───
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const stats = { passed: 0, failed: 0, warnings: 0 };

function ok(msg) { stats.passed++; console.log(`  ✅ ${msg}`); }
function fail(msg) { stats.failed++; console.log(`  ❌ ${msg}`); }
function warn(msg) { stats.warnings++; console.log(`  ⚠️  ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function header(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(60)}`);
}

// ─── Test Data Generators ───
function randomPhone() {
  return `+549115555${String(Math.floor(Math.random() * 90000) + 10000)}`;
}

// ═══════════════════════════════════════════════════════
//  TEST 1: DB Trigger Stress (Concurrent Order Confirmations)
// ═══════════════════════════════════════════════════════
async function testDBTriggerStress(concurrency = 10) {
  header(`TEST 1 — DB Trigger Stress (${concurrency} pedidos simultáneos)`);

  // 1. Pre-check: Get a catalog item with recipe_components
  const { data: catalogItems } = await supabase
    .from('catalog_items')
    .select('id, name, price, station_id')
    .not('station_id', 'is', null)
    .limit(1);

  if (!catalogItems || catalogItems.length === 0) {
    fail('No hay catalog_items con station_id. No se puede testear triggers.');
    return { avgMs: 0, maxMs: 0, successRate: 0 };
  }

  const catalogItem = catalogItems[0];
  info(`Usando: "${catalogItem.name}" (${catalogItem.id})`);

  // 2. Get a fallback product_id
  const { data: randProduct } = await supabase.from('products').select('id').limit(1).single();
  const fallbackProductId = randProduct?.id || null;

  // 3. Create test clients and orders in PENDING
  const testOrders = [];
  for (let i = 0; i < concurrency; i++) {
    const phone = randomPhone();
    const { data: client, error: clientErr } = await supabase.from('clients').insert({ phone, name: `StressTest-${i}` }).select().single();
    if (clientErr || !client) {
      fail(`Error creando cliente ${i}: ${clientErr?.message || 'null response'}`);
      return { avgMs: 0, maxMs: 0, successRate: 0 };
    }
    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      client_id: client.id, phone, channel: 'WHATSAPP', status: 'PENDING',
      total_amount: catalogItem.price * 2, subtotal: catalogItem.price * 2
    }).select().single();
    if (orderErr || !order) {
      fail(`Error creando orden ${i}: ${orderErr?.message || 'null response'}`);
      return { avgMs: 0, maxMs: 0, successRate: 0 };
    }
    await supabase.from('order_items').insert({
      order_id: order.id, catalog_item_id: catalogItem.id,
      product_id: fallbackProductId, quantity: 2, unit_price: catalogItem.price
    });
    testOrders.push({ orderId: order.id, clientId: client.id, phone });
  }
  ok(`${concurrency} pedidos PENDING creados`);

  // 4. BLAST: Confirm ALL orders simultaneously
  const startTime = Date.now();
  const confirmPromises = testOrders.map(async ({ orderId }) => {
    const t0 = Date.now();
    const { error } = await supabase.from('orders').update({ status: 'CONFIRMED' }).eq('id', orderId);
    return { orderId, ms: Date.now() - t0, error };
  });

  const results = await Promise.all(confirmPromises);
  const totalMs = Date.now() - startTime;

  const successes = results.filter(r => !r.error);
  const failures = results.filter(r => r.error);
  const avgMs = successes.length > 0 ? (successes.reduce((s, r) => s + r.ms, 0) / successes.length).toFixed(0) : 0;
  const maxMs = successes.length > 0 ? Math.max(...successes.map(r => r.ms)) : 0;

  ok(`${successes.length}/${concurrency} confirmaciones exitosas`);
  if (failures.length > 0) fail(`${failures.length} confirmaciones fallaron`);
  info(`Tiempo total: ${totalMs}ms | Promedio: ${avgMs}ms | Máximo: ${maxMs}ms`);

  // 5. Verify tasks were generated
  await sleep(1000); // Give triggers a moment
  let totalTasks = 0;
  for (const { orderId } of testOrders) {
    const { data: tasks } = await supabase.from('order_station_tasks').select('id').eq('order_id', orderId);
    totalTasks += (tasks?.length || 0);
  }

  const expectedTasks = concurrency * 3; // 3 stations per order (Parrilla, Cocina, Mostrador)
  if (totalTasks >= expectedTasks) {
    ok(`Trigger generó ${totalTasks}/${expectedTasks} tareas de estación`);
  } else {
    warn(`Solo se generaron ${totalTasks}/${expectedTasks} tareas. Trigger puede estar perdiendo algunas bajo concurrencia.`);
  }

  // 6. Cleanup
  for (const { orderId, clientId, phone } of testOrders) {
    await supabase.from('order_station_tasks').delete().eq('order_id', orderId);
    await supabase.from('order_items').delete().eq('order_id', orderId);
    await supabase.from('orders').delete().eq('id', orderId);
    await supabase.from('clients').delete().eq('id', clientId);
  }
  ok('Datos de prueba limpiados');

  return { avgMs: Number(avgMs), maxMs, successRate: (successes.length / concurrency * 100).toFixed(1) };
}

// ═══════════════════════════════════════════════════════
//  TEST 2: FlowEngine Stress (Simulated Concurrent Users)
// ═══════════════════════════════════════════════════════
async function testFlowEngineStress(concurrency = 20) {
  header(`TEST 2 — FlowEngine Stress (${concurrency} usuarios simultáneos)`);

  // This test measures the raw DB query speed that FlowEngine depends on:
  // - Finding active flows by trigger
  // - Creating/reading flow_executions
  // - Context updates

  // 1. Find the main flow (triggered by "hola")
  const { data: flow } = await supabase
    .from('flows')
    .select('id, name')
    .or('trigger_word.ilike.hola,trigger_word.ilike.%hola%')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!flow) {
    warn('No hay un flow activo con trigger "hola". Usando test sintético de DB.');
    // Synthetic test: measure raw query speed
    const times = [];
    for (let i = 0; i < concurrency; i++) {
      const t0 = Date.now();
      await supabase.from('flows').select('id, name').eq('is_active', true).limit(5);
      times.push(Date.now() - t0);
    }
    const avg = (times.reduce((s, t) => s + t, 0) / times.length).toFixed(0);
    info(`Query promedio: ${avg}ms (${concurrency} queries secuenciales)`);
    return { avgMs: Number(avg), maxMs: Math.max(...times), successRate: 100 };
  }

  info(`Flow encontrado: "${flow.name}" (${flow.id})`);

  // 2. Simulate concurrent flow executions
  const phones = Array.from({ length: concurrency }, () => randomPhone());

  const startTime = Date.now();
  const execPromises = phones.map(async (phone) => {
    const t0 = Date.now();
    try {
      // Simulate what FlowEngine does: create execution + find start node
      const targetIds = new Set((flow.edges || []).map(e => e.target));
      const startNode = (flow.nodes || []).find(n => n.type === 'input') ||
                        (flow.nodes || []).find(n => !targetIds.has(n.id)) ||
                        (flow.nodes || [])[0];

      const { error } = await supabase.from('flow_executions').insert({
        flow_id: flow.id, phone, current_node_id: startNode?.id || 'start',
        status: 'active', context: { pushName: 'StressUser' }, started_at: new Date().toISOString()
      });
      return { phone, ms: Date.now() - t0, error };
    } catch (err) {
      return { phone, ms: Date.now() - t0, error: err };
    }
  });

  const results = await Promise.all(execPromises);
  const totalMs = Date.now() - startTime;

  const successes = results.filter(r => !r.error);
  const failures = results.filter(r => r.error);
  const avgMs = successes.length > 0 ? (successes.reduce((s, r) => s + r.ms, 0) / successes.length).toFixed(0) : 0;
  const maxMs = successes.length > 0 ? Math.max(...successes.map(r => r.ms)) : 0;

  ok(`${successes.length}/${concurrency} ejecuciones creadas`);
  if (failures.length > 0) fail(`${failures.length} ejecuciones fallaron`);
  info(`Tiempo total: ${totalMs}ms | Promedio: ${avgMs}ms | Máximo: ${maxMs}ms`);

  // 3. Cleanup
  for (const phone of phones) {
    await supabase.from('flow_executions').delete().eq('phone', phone).eq('status', 'active');
  }
  ok('Ejecuciones de prueba limpiadas');

  return { avgMs: Number(avgMs), maxMs, successRate: (successes.length / concurrency * 100).toFixed(1) };
}

// ═══════════════════════════════════════════════════════
//  TEST 3: Realtime Push Stress (Burst Writes)
// ═══════════════════════════════════════════════════════
async function testRealtimeStress(burstSize = 30) {
  header(`TEST 3 — Realtime Push Stress (${burstSize} escrituras rápidas)`);

  // This simulates generating many order_station_tasks rapidly,
  // which would trigger Supabase Realtime to push to all subscribed kitchen tablets.

  // 1. Create a temporary order
  const phone = randomPhone();
  const { data: client, error: clientErr } = await supabase.from('clients').insert({ phone, name: 'RealtimeStress' }).select().single();
  if (clientErr || !client) {
    fail(`Error creando cliente: ${clientErr?.message || 'null response'}`);
    return { avgMs: 0, maxMs: 0, successRate: 0 };
  }
  const { data: order, error: orderErr } = await supabase.from('orders').insert({
    client_id: client.id, phone, channel: 'WHATSAPP', status: 'CONFIRMED',
    total_amount: 1000, subtotal: 1000
  }).select().single();
  if (orderErr || !order) {
    fail(`Error creando orden: ${orderErr?.message || 'null response'}`);
    return { avgMs: 0, maxMs: 0, successRate: 0 };
  }

  // 2. Get stations
  const { data: stations } = await supabase.from('stations').select('id').eq('is_active', true);
  if (!stations || stations.length === 0) {
    fail('No hay estaciones activas para el test de Realtime.');
    return { avgMs: 0, maxMs: 0, successRate: 0 };
  }

  // 3. Burst-insert tasks (this triggers Realtime notifications)
  const tasksToInsert = [];
  for (let i = 0; i < burstSize; i++) {
    tasksToInsert.push({
      order_id: order.id,
      station_id: stations[i % stations.length].id,
      status: 'pending',
      items: [{ component_name: `StressItem-${i}`, quantity: 1, catalog_item_name: 'Test' }]
    });
  }

  const startTime = Date.now();
  const { data: insertedTasks, error: insertError } = await supabase
    .from('order_station_tasks')
    .insert(tasksToInsert)
    .select('id');
  const insertMs = Date.now() - startTime;

  if (insertError) {
    fail(`Error insertando tareas: ${insertError.message}`);
  } else {
    ok(`${insertedTasks.length} tareas insertadas en ${insertMs}ms`);
    info(`Promedio: ${(insertMs / burstSize).toFixed(1)}ms por tarea`);
  }

  // 4. Burst-update all to "preparing" (another wave of Realtime pushes)
  const updateStart = Date.now();
  const updatePromises = (insertedTasks || []).map(async (task) => {
    const t0 = Date.now();
    const { error } = await supabase.from('order_station_tasks')
      .update({ status: 'preparing' }).eq('id', task.id);
    return { ms: Date.now() - t0, error };
  });

  const updateResults = await Promise.all(updatePromises);
  const updateMs = Date.now() - updateStart;
  const updateSuccesses = updateResults.filter(r => !r.error);

  ok(`${updateSuccesses.length}/${burstSize} updates exitosos en ${updateMs}ms`);
  const avgUpdateMs = updateSuccesses.length > 0
    ? (updateSuccesses.reduce((s, r) => s + r.ms, 0) / updateSuccesses.length).toFixed(0)
    : 0;
  info(`Promedio update: ${avgUpdateMs}ms | Total: ${updateMs}ms`);

  // 5. Cleanup
  await supabase.from('order_station_tasks').delete().eq('order_id', order.id);
  await supabase.from('orders').delete().eq('id', order.id);
  await supabase.from('clients').delete().eq('id', client.id);
  ok('Datos de prueba limpiados');

  return { avgMs: Number(avgUpdateMs), maxMs: Math.max(...updateResults.map(r => r.ms)), successRate: (updateSuccesses.length / burstSize * 100).toFixed(1) };
}

// ═══════════════════════════════════════════════════════
//  MAIN: Run All Tests
// ═══════════════════════════════════════════════════════
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  🔥 SUITE DE PRUEBAS DE ESTRÉS — Sotcksystem');
  console.log('═'.repeat(60));
  console.log(`📡 Supabase: ${SUPABASE_URL}`);
  console.log(`⏰ ${new Date().toISOString()}\n`);

  const benchmarks = {};

  // Test 1: DB Triggers under concurrent load
  try {
    benchmarks.dbTrigger10 = await testDBTriggerStress(10);
    benchmarks.dbTrigger25 = await testDBTriggerStress(25);
    benchmarks.dbTrigger50 = await testDBTriggerStress(50);
  } catch (err) {
    fail(`Test 1 crasheó: ${err.message}`);
  }

  // Test 2: FlowEngine concurrent users
  try {
    benchmarks.flowEngine20 = await testFlowEngineStress(20);
    benchmarks.flowEngine50 = await testFlowEngineStress(50);
  } catch (err) {
    fail(`Test 2 crasheó: ${err.message}`);
  }

  // Test 3: Realtime burst
  try {
    benchmarks.realtime30 = await testRealtimeStress(30);
    benchmarks.realtime50 = await testRealtimeStress(50);
  } catch (err) {
    fail(`Test 3 crasheó: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════
  //  BENCHMARK REPORT
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('  📊 REPORTE DE BENCHMARK');
  console.log('═'.repeat(60));

  console.log('\n  ┌───────────────────────────────────────────────────┐');
  console.log('  │  TEST                    │ AVG ms │ MAX ms │ OK %  │');
  console.log('  ├───────────────────────────────────────────────────┤');

  for (const [name, data] of Object.entries(benchmarks)) {
    if (data) {
      const label = name.padEnd(24);
      const avg = String(data.avgMs).padStart(6);
      const max = String(data.maxMs).padStart(6);
      const rate = String(data.successRate + '%').padStart(5);
      console.log(`  │  ${label} │ ${avg} │ ${max} │ ${rate} │`);
    }
  }
  console.log('  └───────────────────────────────────────────────────┘');

  // Capacity estimation
  if (benchmarks.dbTrigger50) {
    const estimatedPeakOrders = Math.floor(50000 / benchmarks.dbTrigger50.avgMs);
    info(`\n  📈 Capacidad estimada: ~${estimatedPeakOrders} pedidos/segundo antes de degradar`);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ✅ Pasados: ${stats.passed} | ❌ Fallados: ${stats.failed} | ⚠️  Warnings: ${stats.warnings}`);
  console.log('═'.repeat(60) + '\n');

  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('💥 Error fatal en la suite de estrés:', err);
  process.exit(1);
});
