require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
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
