require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('--- VERIFICANDO ENUMS ---');
    
    const { data: enumInfo, error } = await supabase.rpc('exec_sql', { sql: `
        SELECT enumlabel 
        FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE typname = 'order_status'
    ` });
    
    if (error) {
        console.log('No se pudo usar exec_sql para enums. Probando inserción de prueba...');
        // Try to update an old order to OUT_FOR_DELIVERY to see if it works
        const { error: testErr } = await supabase.from('orders').update({ status: 'OUT_FOR_DELIVERY' }).eq('id', 'deadbeef-0000-0000-0000-000000000000');
        if (testErr) {
            console.log('❌ OUT_FOR_DELIVERY falla:', testErr.message);
        } else {
            console.log('✅ OUT_FOR_DELIVERY parece válido.');
        }
    } else {
        console.log('Valores permitidos en order_status:');
        console.table(enumInfo);
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
