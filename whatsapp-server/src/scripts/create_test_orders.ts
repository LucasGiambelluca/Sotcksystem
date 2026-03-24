import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from the root of whatsapp-server
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Generating 6 test orders...');

  const addresses = [
    'Av. Corrientes 1234, CABA',
    'Calle Falsa 123, Bahía Blanca',
    'Sarmiento 450, Bahía Blanca',
    'Cramer 330, Bahía Blanca',
    'Brown 1200, Bahía Blanca',
    'Rodriguez 55, Bahía Blanca'
  ];

  try {
    const { data: items } = await supabase.from('catalog_items').select('id, name, price').limit(2);
    if (!items || items.length === 0) {
      console.error('No items found in catalog_items');
      return;
    }

    const { data: client } = await supabase.from('clients').select('id, phone, name').limit(1).single();
    
    for (let i = 0; i < 2; i++) {
        const total = items.reduce((sum, item) => sum + Number(item.price), 0);
        const status = i === 0 ? 'PENDING' : 'IN_PREPARATION';
        
        const { data: order, error: orderErr } = await supabase.from('orders').insert({
          client_id: client ? client.id : null,
          status: status,
          total_amount: total,
          channel: 'WHATSAPP',
          phone: client ? client.phone : `54911122233${i}`,
          delivery_address: addresses[i],
          delivery_type: 'DELIVERY',
          chat_context: { pushName: `Test ${status} ${i + 1}`, original_text: `Pedido de prueba ${status}` }
        }).select().single();

        if (orderErr) {
            console.error(`Error creating order ${i}:`, orderErr);
            continue;
        }

        const orderItems = items.map(item => ({
          order_id: (order as any).id,
          catalog_item_id: item.id,
          quantity: 1,
          unit_price: item.price,
          subtotal: item.price
        }));

        const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
        if (itemsErr) console.error(`Error items for order ${i}:`, itemsErr);

        console.log(`✅ Pedido #${(order as any).order_number} [${status}] creado con éxito.`);
    }
  } catch (err) {
    console.error('Unexpected Error:', err);
  }
}

main();
