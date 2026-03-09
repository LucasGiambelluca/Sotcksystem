require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const { data: msgs } = await supabase.from('whatsapp_messages').select('*').order('created_at', { ascending: false }).limit(3);
  console.log(JSON.stringify(msgs, null, 2));
}

main();
