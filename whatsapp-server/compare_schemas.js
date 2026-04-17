const { createClient } = require('@supabase/supabase-js');

async function getColumns(url, key) {
    const supabase = createClient(url, key);
    const { data: cols, error } = await supabase.rpc('get_table_columns', { table_name: 'orders' });
    if (error) {
        // Fallback: try to select 1 row and check keys
        const { data: row } = await supabase.from('orders').select('*').limit(1).single();
        return row ? Object.keys(row).sort() : ['ERROR: NO DATA'];
    }
    return cols.map(c => c.column_name).sort();
}

const LOCAL_URL = 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co';
const LOCAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MSwiZXhwIjoyMDg5NjAxODgxfQ.gYQ5UXEKqWePvP5JPVGWnQ0jQKlqLpXFYDR77oSSq_c';

const VPS_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const VPS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';

async function run() {
    console.log('--- Checking LOCAL Schemas ---');
    const localCols = await getColumns(LOCAL_URL, LOCAL_KEY);
    console.log(localCols.join(', '));
    
    console.log('--- Checking VPS Schemas ---');
    const vpsCols = await getColumns(VPS_URL, VPS_KEY);
    console.log(vpsCols.join(', '));
}
run();
