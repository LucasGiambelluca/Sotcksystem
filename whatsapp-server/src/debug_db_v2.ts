
import { supabase } from './config/database';

async function check() {
    console.log('--- PRINTER CONFIG ---');
    const { data: pCfg } = await supabase.from('printer_config').select('*').limit(1).maybeSingle();
    console.log(JSON.stringify(pCfg, null, 2));

    console.log('\n--- LAST 3 PRINT JOBS ---');
    const { data: jobs } = await supabase.from('print_queue').select('*').order('created_at', { ascending: false }).limit(3);
    console.log(JSON.stringify(jobs?.map((j: any) => ({ id: j.id, order_id: j.order_id, logo_url: j.logo_url, status: j.status })), null, 2));
}

check().catch(console.error);
