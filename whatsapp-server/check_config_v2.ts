import { supabase } from './config/database';

async function checkConfig() {
  console.log('--- WHATSAPP CONFIG ---');
  const { data, error } = await supabase.from('whatsapp_config').select('*').order('id', { ascending: false }).limit(1).maybeSingle();
  if (error) {
    console.error('Error fetching whatsapp_config:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }

  console.log('--- PUBLIC BRANDING (if exists) ---');
  const { data: pb, error: pbErr } = await supabase.from('public_branding').select('*').maybeSingle();
  if (pbErr) {
    console.error('Error fetching public_branding:', pbErr);
  } else {
    console.log(JSON.stringify(pb, null, 2));
  }
}

checkConfig();
