require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('--- INSPECCIÓN DE MISIONES Y PEDIDOS ---');
    
    // 1. Check assignments
    const { data: assignments, error: assignError } = await supabase
      .from('assignments')
      .select('*, assignment_orders(count)');
    
    if (assignError) console.error('Error assignments:', assignError.message);
    else {
        console.log(`Misiones encontradas: ${assignments.length}`);
        console.table(assignments.map(a => ({
            id: a.id,
            status: a.status,
            stops: a.assignment_orders[0].count,
            created_at: a.created_at
        })));
    }

    // 2. Check orders status
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, status, delivery_type')
      .in('status', ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP'])
      .eq('delivery_type', 'DELIVERY');
    
    if (ordersError) console.error('Error orders:', ordersError.message);
    else {
        console.log(`Pedidos en tránsito/reparto: ${orders.length}`);
        console.table(orders);
    }

    // 3. Check assignment_orders for one mission
    if (assignments.length > 0) {
        const lastId = assignments[assignments.length - 1].id;
        console.log(`\nDetalle de paradas para misión: ${lastId}`);
        const { data: stops } = await supabase
            .from('assignment_orders')
            .select('*, order:orders(status, delivery_address)')
            .eq('assignment_id', lastId)
            .order('sequence_number', { ascending: true });
        console.table(stops.map(s => ({
            seq: s.sequence_number,
            type: s.action_type,
            status: s.status,
            order_id: s.order_id,
            order_status: s.order?.status,
            address: s.order?.delivery_address
        })));
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
