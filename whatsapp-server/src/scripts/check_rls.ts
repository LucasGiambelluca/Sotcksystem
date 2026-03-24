import { supabase } from '../config/database';

async function checkRLS() {
  const { data, error } = await supabase.rpc('get_policies_for_table', { tname: 'flows' });
  
  if (error) {
    // If RPC doesn't exist, try a direct query to see if we get a result
    const { data: flows, error: directError } = await supabase.from('flows').select('id').limit(1);
    console.log('Direct query test:', flows ? 'Success' : 'Failed', directError || '');
  } else {
    console.log('Policies:', JSON.stringify(data, null, 2));
  }
}

checkRLS();
