import { supabase } from '../config/database';

async function findCheckoutFlow() {
  const { data: flows, error } = await supabase
    .from('flows')
    .select('id, name, description');

  if (error) {
    console.error('Error fetching flows:', error);
    return;
  }

  console.log('--- AVAILABLE FLOWS ---');
  console.log(JSON.stringify(flows, null, 2));
}

findCheckoutFlow();
