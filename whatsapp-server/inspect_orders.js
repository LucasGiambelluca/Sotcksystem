require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    const { data: orders, error } = await supabase.from('orders').select().limit(1);
    if (error) {
        console.error('Error:', error);
    } else if (orders && orders.length > 0) {
        console.table(Object.keys(orders[0]).map(k => ({ column: k })));
    } else {
        console.log('No hay pedidos para inspeccionar columnas.');
    }
  } catch (err) {
    console.error('Error inesperado:', err);
  }
}

main();
