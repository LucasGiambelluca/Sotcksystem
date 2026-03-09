require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('--- CREANDO PEDIDOS DE PRUEBA ---');
    
    // Get some catalog items to use
    const { data: items } = await supabase.from('catalog_items').select('id, name, price').limit(2);
    if (!items || items.length === 0) {
        console.error('No hay items en el catálogo para crear el pedido.');
        return;
    }

    const testOrders = [
      {
        client_name: 'Ana García',
        delivery_address: 'Av. Colón 123, Bahía Blanca',
        total_amount: items[0].price,
        status: 'IN_PREPARATION', // So it appears as "Cooking" in the dashboard
        delivery_type: 'DELIVERY'
      },
      {
        client_name: 'Carlos Pérez',
        delivery_address: 'Rodríguez 456, Bahía Blanca',
        total_amount: items[0].price * 2,
        status: 'IN_PREPARATION',
        delivery_type: 'DELIVERY'
      },
      {
        client_name: 'Lucía Sosa',
        delivery_address: 'San Martín 789, Bahía Blanca',
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

        console.log(`Pedido #${order.order_number} creado para ${order.client_name}`);

        // Add items to the order
        const { error: itemErr } = await supabase
            .from('order_items')
            .insert({
                order_id: order.id,
                catalog_item_id: items[0].id,
                quantity: 1,
                unit_price: items[0].price,
                name: items[0].name
            });
        
        if (itemErr) {
            console.error('Error insertando items:', itemErr);
        }
    }
    console.log('--- FINALIZADO ---');
  } catch (err) {
    console.error('Error inesperado:', err);
  }
}

main();
