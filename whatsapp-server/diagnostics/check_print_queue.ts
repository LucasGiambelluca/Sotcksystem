import { supabase } from './config/database';
async function run() {
  const { data, error } = await supabase.from('print_queue').select('*').order('created_at', { ascending: false }).limit(1);
  if (error) console.error(error);
  else {
    const raw = Buffer.from(data[0].raw_content, 'base64');
    console.log('Last Print Job (First 10 bytes):', raw.slice(0, 10));
  }
}
run();
