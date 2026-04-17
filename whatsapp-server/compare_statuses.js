const { createClient } = require('@supabase/supabase-js');

async function getStatuses(url, key, label) {
    const supabase = createClient(url, key);
    const { data: rows, error } = await supabase.from('orders').select('status');
    if (error) {
        console.error(`Error in ${label}:`, error);
        return [];
    }
    const uniqueStatuses = Array.from(new Set(rows.map(r => r.status))).sort();
    return uniqueStatuses;
}

const LOCAL_URL = 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co';
const LOCAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MSwiZXhwIjoyMDg5NjAxODgxfQ.gYQ5UXEKqWePvP5JPVGWnQ0jQKlqLpXFYDR77oSSq_c';

const VPS_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const VPS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';

async function run() {
    console.log('--- Order Status Comparison ---');
    const localStatuses = await getStatuses(LOCAL_URL, LOCAL_KEY, 'LOCAL');
    const vpsStatuses = await getStatuses(VPS_URL, VPS_KEY, 'VPS');

    console.log('\nLOCAL Statuses:', localStatuses.join(', ') || 'NONE FOUND');
    console.log('VPS Statuses:', vpsStatuses.join(', ') || 'NONE FOUND');
    
    // Also check if status is a constrained type (Enum) or just text
    // We'll guess by the values.
}
run();
