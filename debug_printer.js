const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
    'https://zmwzwdgmjrlxtwcwxhhn.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjU4ODEsImV4cCI6MjA4OTYwMTg4MX0.tdHBvWlWVIL6FCNykbL960a2lP3h4qtwJCX53YkX2xA'
);

async function check() {
    console.log('--- DIAGNOSTICO DE IMPRESION ---');
    
    const { data: config, error: configError } = await supabase
        .from('printer_config')
        .select('*')
        .maybeSingle();
    
    if (configError) console.error('Error config:', configError);
    console.log('CONFIGURACION:', {
        store_name: config?.store_name,
        print_logo: config?.print_logo,
        logo_url: config?.logo_url ? 'PRESENTE' : 'AUSENTE'
    });

    const { data: queue, error: queueError } = await supabase
        .from('print_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    if (queueError) console.error('Error cola:', queueError);
    
    console.log('\nULTIMOS TRABAJOS:');
    queue?.forEach(job => {
        console.log(`- ID: ${job.id.slice(0,8)} | Status: ${job.status} | Largo: ${job.raw_content?.length || 0} bytes`);
    });
}

check().catch(console.error);
