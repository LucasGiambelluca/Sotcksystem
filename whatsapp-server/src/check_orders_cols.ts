import { supabase } from './config/database';
async function run() {
  const { data, error } = await supabase.from('orders').select('*').limit(1);
  if (error) console.error(error);
  else console.log('Orders columns:', Object.keys(data[0] || {}));
}
run();
