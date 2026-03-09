require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Get latest order with ALL columns
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  console.log('--- LATEST ORDER (all columns) ---');
  console.log(JSON.stringify(order, null, 2));
  if (error) console.log('Error:', error);
}

main();
