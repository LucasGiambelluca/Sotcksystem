import { supabase } from '../config/database';

async function check() {
  const { data: recentOrders, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }

  console.log('--- RECENT ORDERS ---');
  console.log(JSON.stringify(recentOrders, null, 2));

  const { data: stations } = await supabase.from('stations').select('*');
  console.log('--- STATIONS ---');
  console.log(JSON.stringify(stations, null, 2));
}

check();
