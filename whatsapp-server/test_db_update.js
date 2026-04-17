const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
    try {
        const { data, error } = await supabase.rpc('query_rls_policies');
        if (error) {
            console.log('No RPC for RLS, trying direct SQL via raw query if REST allows...');
        } else {
            console.log(data);
        }
    } catch (e) {
        console.error(e);
    }
}

run();
