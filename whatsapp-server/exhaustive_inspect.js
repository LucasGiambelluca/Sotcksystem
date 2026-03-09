require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('--- INSPECCIÓN EXHAUSTIVA DE TABLAS ---');
    
    // We try to query information_schema via a trick: 
    // Since we don't have exec_sql, we can't query information_schema directly via Supabase JS client 
    // UNLESS we have a custom view.
    
    // However, we can use the 'supabase' object to try to list all tables if possible, 
    // but the JS client is designed for a known schema.
    
    // Let's try to query a known public table and see if that works.
    const { data: orders, error: ordersErr } = await supabase.from('orders').select('id').limit(1);
    console.log('Orders accesibles:', !!orders);
    if (ordersErr) console.log('Error orders:', ordersErr.message);

    // Let's try to "force" the creation of the tables if they are missing.
    // If I can't find them, I'll just re-run the migration SQL.
    
    console.log('\nIntentando buscar "assignments" de forma directa...');
    const { data: assignments, error: assignErr } = await supabase.from('assignments').select('id').limit(1);
    if (assignErr) {
        console.log('❌ assignments error:', assignErr.message, '(' + assignErr.code + ')');
    } else {
        console.log('✅ assignments existe y es accesible.');
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
