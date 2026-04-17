const { createClient } = require('@supabase/supabase-js');

async function getColumns(url, key, table) {
    const supabase = createClient(url, key);
    const { data: row } = await supabase.from(table).select('*').limit(1).maybeSingle();
    return row ? Object.keys(row).sort() : [];
}

const LOCAL_URL = 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co';
const LOCAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MSwiZXhwIjoyMDg5NjAxODgxfQ.gYQ5UXEKqWePvP5JPVGWnQ0jQKlqLpXFYDR77oSSq_c';

const VPS_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const VPS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';

async function run() {
    const tables = ['whatsapp_config', 'orders'];
    for (const table of tables) {
        console.log(`\n--- Comparing table: ${table} ---`);
        const localCols = await getColumns(LOCAL_URL, LOCAL_KEY, table);
        const vpsCols = await getColumns(VPS_URL, VPS_KEY, table);
        
        const missingInVps = localCols.filter(c => !vpsCols.includes(c));
        const missingInLocal = vpsCols.filter(c => !localCols.includes(c));
        
        console.log(`Missing in VPS: ${missingInVps.join(', ') || 'NONE'}`);
        console.log(`Missing in LOCAL: ${missingInLocal.join(', ') || 'NONE'}`);
    }
}
run();
