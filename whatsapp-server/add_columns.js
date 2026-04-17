const { createClient } = require('@supabase/supabase-js');

const URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';
const supabase = createClient(URL, KEY);

async function addColumns() {
    console.log('--- Adding missing columns to whatsapp_config ---');
    // Using RPC to add columns via SQL if possible, or just raw query if I had a tool. 
    // Since I don't have a direct SQL tool, I'll use the API to check if I can just insert/update and see it fail, 
    // but the best way is to tell the user to run it OR if there's an exec_sql rpc.
    // I'll check for exec_sql rpc.
    
    const { data: rpcs } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' }).catch(e => ({ error: e }));
    if (rpcs && !rpcs.error) {
        console.log('RPC exec_sql available. Adding columns...');
        await supabase.rpc('exec_sql', { sql: 'ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS template_ready TEXT;' });
        await supabase.rpc('exec_sql', { sql: 'ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS template_arrived TEXT;' });
        console.log('Columns added successfully.');
    } else {
        console.log('RPC exec_sql NOT available. Please run the SQL manually:');
        console.log('ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS template_ready TEXT;');
        console.log('ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS template_arrived TEXT;');
    }
}

addColumns();
