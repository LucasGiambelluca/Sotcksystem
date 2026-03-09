require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Check ALL orders with their chat_context to see if items are embedded
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, chat_context')
    .not('chat_context', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (orders) {
    orders.forEach(o => {
      const ctx = o.chat_context || {};
      console.log(`\nOrder #${o.order_number}:`);
      console.log('  Keys:', Object.keys(ctx));
      if (ctx.order_items) console.log('  order_items:', JSON.stringify(ctx.order_items));
      if (ctx.created_order) console.log('  created_order keys:', Object.keys(ctx.created_order));
    });
  }

  // Check order_items table columns
  const { data: cols } = await supabase.from('order_items').select('*').limit(0);
  console.log('\n--- order_items columns (from empty query) ---');
  // Let's try inserting and seeing what columns exist
  const { error: schemaErr } = await supabase.from('order_items').select('*').limit(1);
  console.log('Schema query error:', schemaErr);

  // Check if draft_orders have items
  const { data: drafts } = await supabase
    .from('draft_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);
  
  console.log('\n--- DRAFT ORDERS ---');
  if (drafts) {
    drafts.forEach(d => {
      console.log(`Draft ${d.id.slice(0,8)} (${d.status}):`);
      console.log('  Items:', JSON.stringify(d.items));
    });
  }
}

main();
