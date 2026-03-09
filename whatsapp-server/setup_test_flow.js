require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('--- CONFIGURANDO ENTORNO DE PRUEBA ---');

    // 1. Get or Create Client
    let { data: client } = await supabase.from('clients').select('id').limit(1).maybeSingle();
    if (!client) {
      console.log('Creando cliente de prueba...');
      const { data, error } = await supabase
        .from('clients')
        .insert({ name: 'Cliente de Prueba', phone: '5492914000000' })
        .select()
        .single();
      if (error) throw error;
      client = data;
    }
    console.log('Cliente ID:', client.id);

    // 2. Get Catalog Items
    const { data: items } = await supabase.from('catalog_items').select('id, name, price').limit(2);
    if (!items || items.length === 0) {
      throw new Error('No hay items en el catálogo. Por favor crea alguno primero.');
    }

    const testOrders = [
      {
        client_id: client.id,
        delivery_address: 'Hospital Municipal de Bahía Blanca',
        total_amount: items[0].price,
        status: 'IN_PREPARATION',
        delivery_type: 'DELIVERY'
      },
      {
        client_id: client.id,
        delivery_address: 'Hospital Penna, Bahía Blanca',
        total_amount: items[0].price * 1.5,
        status: 'IN_PREPARATION',
        delivery_type: 'DELIVERY'
      },
      {
        client_id: client.id,
        delivery_address: 'Municipalidad de Bahía Blanca',
        total_amount: items[0].price,
        status: 'IN_PREPARATION',
        delivery_type: 'DELIVERY'
      }
    ];

    for (const orderData of testOrders) {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();
      
      if (orderErr) {
        console.error('Error creando pedido:', orderErr);
        continue;
      }

      console.log(`Pedido #${order.order_number} creado.`);

      // Add items
      await supabase.from('order_items').insert({
        order_id: order.id,
        catalog_item_id: items[0].id,
        quantity: 1,
        unit_price: items[0].price,
        name: items[0].name
      });
    }

    console.log('--- TODO LISTO ---');
    console.log('Revisa el Kitchen Dashboard para ver los pedidos en "En Cocina".');
  } catch (err) {
    console.error('Error inesperado:', err.message);
  }
}

main();
