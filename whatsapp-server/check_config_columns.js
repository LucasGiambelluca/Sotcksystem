const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
async function run() {
    const { data: config } = await supabase.from('whatsapp_config').select('*').limit(1).single();
    console.log('--- WhatsApp Config Columns ---');
    console.log(Object.keys(config));
    console.log('--- Content ---');
    console.log(config);
}
run();
