require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('--- Testing Orders Query ---');
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, client:clients(name)')
      .in('status', ['READY', 'IN_TRANSIT', 'CONFIRMED', 'OUT_FOR_DELIVERY'])
      .limit(5);
    
    if (error) throw error;
    console.log('Orders query success. Found:', data.length);
  } catch (err) {
    console.error('Orders query FAILED:', err.message);
  }

  console.log('\n--- Testing Shifts/Cadetes Query ---');
  try {
    const { data, error } = await supabase
      .from('shifts')
      .select(`
        *,
        employee:employees (*),
        station:stations (*),
        metadata:cadete_metadata (*)
      `)
      .eq('status', 'ACTIVE');
    
    if (error) throw error;
    console.log('Shifts query success. Found:', data.length);
  } catch (err) {
    console.error('Shifts query FAILED:', err.message);
  }

  console.log('\n--- Testing Locations Query ---');
  try {
    const { data, error } = await supabase
      .from('cadete_locations')
      .select('*')
      .limit(5);
    
    if (error) throw error;
    console.log('Locations query success. Found:', data.length);
  } catch (err) {
    console.error('Locations query FAILED:', err.message);
  }
}

diagnose();
