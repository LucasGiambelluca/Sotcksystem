const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function dumpFlows() {
  const { data, error } = await supabase.from('flows').select('*').eq('is_active', true);
  if (error) {
    console.error('Error fetching flows:', error);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

dumpFlows();
