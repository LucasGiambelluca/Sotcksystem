import { supabase } from './supabaseClient';

async function check() {
  const { data, error } = await supabase.from('assignments').select('*').limit(1);
  if (error) {
    console.error('Error fetching assignments:', error);
  } else {
    console.log('Assignments columns:', Object.keys(data[0] || {}));
  }
}

check();
