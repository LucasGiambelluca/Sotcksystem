const { createClient } = require('@supabase/supabase-js');

const URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';
const supabase = createClient(URL, KEY);

async function inspectSchema() {
    console.log('--- Inspecting whatsapp_config schema ---');
    const { data, error } = await supabase.from('whatsapp_config').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
        return;
    }
    if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]).sort().join(', '));
        // console.log('Full data:', JSON.stringify(data[0], null, 2));
    } else {
        console.log('No data in whatsapp_config');
    }
}

inspectSchema();
