const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('id, status, order_number, created_at, chat_context, order_items(*)')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('--- RECENT ORDERS ---');
  console.log(JSON.stringify(recentOrders, null, 2));

  const { data: stations } = await supabase.from('stations').select('*');
  console.log('--- STATIONS ---');
  console.log(JSON.stringify(stations, null, 2));
}

check();
