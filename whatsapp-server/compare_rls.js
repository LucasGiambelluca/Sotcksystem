const { createClient } = require('@supabase/supabase-js');

async function getRLSStatus(url, key) {
    const supabase = createClient(url, key);
    // Querying pg_tables to check relrowsecurity
    const { data, error } = await supabase.rpc('exec_sql', { 
        sql: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;` 
    }).catch(() => ({ data: null }));

    if (!data) {
        // Fallback: try to just list tables if exec_sql fails
        return { error: 'exec_sql not available' };
    }
    return data;
}

const LOCAL_URL = 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co';
const LOCAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MSwiZXhwIjoyMDg5NjAxODgxfQ.gYQ5UXEKqWePvP5JPVGWnQ0jQKlqLpXFYDR77oSSq_c';

const VPS_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const VPS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';

async function run() {
    console.log('--- Database RLS Comparison ---');
    const localRLS = await getRLSStatus(LOCAL_URL, LOCAL_KEY);
    const vpsRLS = await getRLSStatus(VPS_URL, VPS_KEY);

    if (localRLS.error || vpsRLS.error) {
        console.log('Cannot compare automatically (exec_sql missing). Checking manual pointers...');
        return;
    }

    // Compare
    console.log('Table | LOCAL RLS | VPS RLS');
    console.log('---------------------------');
    const allTables = Array.from(new Set([...localRLS.map(t => t.tablename), ...vpsRLS.map(t => t.tablename)])).sort();
    
    for (const table of allTables) {
        const l = localRLS.find(t => t.tablename === table);
        const v = vpsRLS.find(t => t.tablename === table);
        console.log(`${table.padEnd(20)} | ${l ? (l.rowsecurity ? 'ON' : 'OFF') : 'N/A'} | ${v ? (v.rowsecurity ? 'ON' : 'OFF') : 'N/A'}`);
    }
}
run();
