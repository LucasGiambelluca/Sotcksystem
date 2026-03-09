require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_number, status, delivery_address, client_id')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Error:', error);
      return;
    }

    console.table(orders);
  } catch (err) {
    console.error('Error inesperado:', err);
  }
}

main();
