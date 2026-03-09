require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const { data: flows, error } = await supabase.from('flows').select('id, name, trigger_word, nodes').eq('trigger_word', 'checkout_catalogo');
  if (error) console.error(error);
  else console.log(JSON.stringify(flows, null, 2));
}

main();
