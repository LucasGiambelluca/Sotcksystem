require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'shipping_zones';
    `
  });
  if (error) {
    console.log('Cant use rpc exec_sql for info schema');
  } else {
    console.log('Columns:', data);
  }
}

main();
