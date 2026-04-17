const { createClient } = require('@supabase/supabase-js');

async function getRecentStatuses(url, key, label) {
    const supabase = createClient(url, key);
    const { data: rows, error } = await supabase.from('orders').select('status, order_number').order('created_at', { ascending: false }).limit(100);
    if (error) {
        console.error(`Error in ${label}:`, error);
        return [];
    }
    const statuses = rows.map(r => r.status);
    const unique = Array.from(new Set(statuses)).sort();
    console.log(`${label} Unique Statuses (Last 100):`, unique);
    // Count them
    const counts = statuses.reduce((acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc; }, {});
    console.log(`${label} Status Counts:`, counts);
}

const LOCAL_URL = 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co';
const LOCAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MSwiZXhwIjoyMDg5NjAxODgxfQ.gYQ5UXEKqWePvP5JPVGWnQ0jQKlqLpXFYDR77oSSq_c';

const VPS_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const VPS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';

async function run() {
    await getRecentStatuses(LOCAL_URL, LOCAL_KEY, 'LOCAL');
    await getRecentStatuses(VPS_URL, VPS_KEY, 'VPS');
}
run();
