const { createClient } = require('@supabase/supabase-js');

async function getColumnType(url, key, label) {
    const supabase = createClient(url, key);
    const { data, error } = await supabase.rpc('exec_sql', { 
        sql: `SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status';` 
    }).catch(() => ({ data: null }));

    if (!data) {
        console.log(`${label}: exec_sql failed.`);
        return null;
    }
    return data[0];
}

const LOCAL_URL = 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co';
const LOCAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MSwiZXhwIjoyMDg5NjAxODgxfQ.gYQ5UXEKqWePvP5JPVGWnQ0jQKlqLpXFYDR77oSSq_c';

const VPS_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const VPS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';

async function run() {
    console.log('--- Order Status Column Type ---');
    const local = await getColumnType(LOCAL_URL, LOCAL_KEY, 'LOCAL');
    const vps = await getColumnType(VPS_URL, VPS_KEY, 'VPS');

    if (local) console.log('LOCAL:', local);
    if (vps) console.log('VPS:', vps);
}
run();
