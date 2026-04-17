const { createClient } = require('@supabase/supabase-js');

const URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';
const supabase = createClient(URL, KEY);

async function syncSchema() {
    console.log('--- Syncing missing columns to VPS whatsapp_config ---');
    // We'll use the API to check if adding via RPC is possible. 
    // If not, we'll suggest SQL to the user.
    try {
        const { error: e1 } = await supabase.rpc('exec_sql', { sql: 'ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS checkout_message TEXT;' });
        const { error: e2 } = await supabase.rpc('exec_sql', { sql: 'ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS sileo_api_key TEXT;' });
        
        if (e1 || e2) {
            console.log('Failed to add columns via RPC. RPC exec_sql might be missing or permissions denied.');
            console.log('Error 1:', e1);
            console.log('Error 2:', e2);
        } else {
            console.log('Columns added successfully.');
        }
    } catch (err) {
        console.error('Exception:', err.message);
    }
}

syncSchema();
