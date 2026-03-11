require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  console.log('Connecting to:', process.env.VITE_SUPABASE_URL);

  try {
    const { data: items } = await supabase.from('catalog_items').select('id, name, price').limit(2);
    if (!items || items.length === 0) {
      console.error('No items found in catalog');
      return;
    }

    const { data: client } = await supabase.from('clients').select('id, phone, name').limit(1).single();
    
    const total = items.reduce((sum, i) => sum + Number(i.price), 0);
    
    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      client_id: client ? client.id : null,
      status: 'PENDING',
      total_amount: total,
      channel: 'WHATSAPP',
      phone: client ? client.phone : '549111222333',
      delivery_address: 'Av. Corrientes 1234, CABA',
      delivery_type: 'DELIVERY',
      chat_context: { pushName: 'Cliente de Prueba' }
    }).select().single();

    if (orderErr) throw orderErr;

    const orderItems = items.map(i => ({
      order_id: order.id,
      catalog_item_id: i.id,
      quantity: 1,
      unit_price: i.price,
      subtotal: i.price
    }));

    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
    if (itemsErr) throw itemsErr;

    console.log(`✅ Pedido #${order.order_number} creado con éxito.`);
    console.log(`Detalles: ${items.map(i => i.name).join(', ')}`);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
