const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './client/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('id, status, order_number, created_at, chat_context, order_items(*)')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('--- RECENT ORDERS ---');
  recentOrders.forEach(o => {
    console.log(`Order #${o.order_number} | Status: ${o.status} | Name: ${o.chat_context?.pushName} | Items: ${o.order_items?.length}`);
  });
}

check();
