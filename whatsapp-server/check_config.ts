import { supabase } from './config/database';

async function checkConfig() {
  const { data, error } = await supabase.from('printer_config').select('*').limit(1).maybeSingle();
  if (error) {
    console.error('Error fetching printer_config:', error);
  } else {
    console.log('--- PRINTER CONFIG ---');
    console.log(JSON.stringify(data, null, 2));
  }

  const { data: branding, error: bError } = await supabase.from('public_branding').select('*').maybeSingle();
  if (bError) {
    console.error('Error fetching public_branding:', bError);
  } else {
    console.log('--- PUBLIC BRANDING ---');
    console.log(JSON.stringify(branding, null, 2));
  }
}

checkConfig();
