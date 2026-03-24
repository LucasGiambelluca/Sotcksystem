const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Usar .env local de whatsapp-server

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function fix() {
  console.log('Restoring test orders #17 and #18...');
  
  const { error: err1 } = await supabase
    .from('orders')
    .update({ status: 'PENDING' })
    .eq('order_number', 17);
    
  const { error: err2 } = await supabase
    .from('orders')
    .update({ status: 'IN_PREPARATION' })
    .eq('order_number', 18);

  if (err1 || err2) {
    console.error('Error updating orders:', err1 || err2);
  } else {
    console.log('✅ Statuses restored to PENDING and IN_PREPARATION.');
  }
}

fix();
