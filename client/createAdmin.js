
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const supabaseKey = 'sb_secret_MRJp7r4am5JIrS2raD13Jw_wzvfInAI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@admin.com',
    password: 'admin',
    email_confirm: true
  });

  if (error) {
    console.error('Error creating user:', error);
  } else {
    console.log('User created successfully:', data);
  }
}

createAdmin();
