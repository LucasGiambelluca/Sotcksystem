const { createClient } = require('@supabase/supabase-js');

async function getRoutineDefinition(url, key, routineName) {
    const supabase = createClient(url, key);
    const { data, error } = await supabase.rpc('exec_sql', { 
        sql: `SELECT routine_definition FROM information_schema.routines WHERE routine_name = '${routineName}';` 
    }).catch(() => ({ data: null }));

    if (!data) {
        return null;
    }
    return data[0]?.routine_definition;
}

const LOCAL_URL = 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co';
const LOCAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MSwiZXhwIjoyMDg5NjAxODgxfQ.gYQ5UXEKqWePvP5JPVGWnQ0jQKlqLpXFYDR77oSSq_c';

const VPS_URL = 'https://bomzcidnpslryfgnrsrs.supabase.co';
const VPS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvbXpjaWRucHNscnlmZ25yc3JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTA5OCwiZXhwIjoyMDgzNTY3MDk4fQ.XpobbRlaNeWFKWc8c58Es0e3K9abPKJa3EzgA0Ri0J8';

async function run() {
    console.log('--- Inspecting trg_log_status_change routine ---');
    const localDef = await getRoutineDefinition(LOCAL_URL, LOCAL_KEY, 'log_order_status_change');
    // Note: the routine name might be slightly different than the trigger name
    
    console.log('LOCAL Logic found:', localDef ? 'YES' : 'NO');
    if (localDef) console.log(localDef);

    const vpsDef = await getRoutineDefinition(VPS_URL, VPS_KEY, 'log_order_status_change');
    console.log('VPS Logic found:', vpsDef ? 'YES' : 'NO');
    if (vpsDef) console.log(vpsDef);
}
run();
