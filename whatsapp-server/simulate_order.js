require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Apply the migration: make product_id nullable
  console.log('Applying schema fix: make product_id nullable...');
  const { error: alterErr } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;'
  });

  // If rpc doesn't exist, we'll use a workaround
  if (alterErr) {
    console.log('RPC exec_sql not available, trying direct approach...');
    // We need pg for direct SQL
    const { Client } = require('pg');
    const pg = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
    try {
      await pg.connect();
      await pg.query('ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;');
      await pg.query('CREATE INDEX IF NOT EXISTS idx_order_items_catalog_item_id ON order_items(catalog_item_id);');
      console.log('✅ Schema fixed via pg!');
      await pg.end();
    } catch (pgErr) {
      console.error('PG error:', pgErr.message);
      console.log('\n⚠️ Please run this SQL in the Supabase SQL Editor:');
      console.log('ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;');
      return;
    }
  } else {
    console.log('✅ Schema fixed via RPC!');
  }

  // Now create the test order with items
  const { data: client } = await supabase.from('clients').select('id, name').limit(1).single();
  if (!client) { console.error('No clients'); return; }

  const { data: catalogItems } = await supabase.from('catalog_items').select('id, name, price').eq('is_active', true).limit(3);
  if (!catalogItems || catalogItems.length === 0) { console.error('No catalog items'); return; }

  const items = catalogItems.map(ci => ({
    catalog_item_id: ci.id,
    qty: Math.floor(Math.random() * 3) + 1,
    price: ci.price,
    name: ci.name,
  }));
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  const { data: order, error: orderErr } = await supabase.from('orders').insert({
    client_id: client.id,
    channel: 'WHATSAPP',
    status: 'PENDING',
    total_amount: total,
    subtotal: total,
    phone: '5491155009999',
    delivery_type: 'DELIVERY',
    delivery_address: 'Calle Falsa 123, Bahía Blanca',
    payment_method: 'Efectivo',
    payment_status: 'PENDING',
    chat_context: { pushName: client.name, delivery_type: 'Envío a domicilio', direccion: 'Calle Falsa 123, Bahía Blanca' }
  }).select().single();

  if (orderErr) { console.error('Order error:', orderErr); return; }

  const orderItemsData = items.map(item => ({
    order_id: order.id,
    catalog_item_id: item.catalog_item_id,
    quantity: item.qty,
    unit_price: item.price,
  }));

  const { error: itemsErr } = await supabase.from('order_items').insert(orderItemsData);
  if (itemsErr) {
    console.error('❌ Items error:', itemsErr);
  } else {
    console.log(`\n✅ Order #${order.order_number} created with ${items.length} items:`);
    items.forEach(i => console.log(`   ${i.qty}x ${i.name} ($${i.price})`));
    console.log(`   Total: $${total}`);
    console.log('\n🔔 Mirá el panel de comandas ahora!');
  }
}

main();
