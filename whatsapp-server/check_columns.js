const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MSwiZXhwIjoyMDg5NjAxODgxfQ.gYQ5UXEKqWePvP5JPVGWnQ0jQKlqLpXFYDR77oSSq_c';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkColumns() {
    const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
    } else {
        console.log('No data found, trying to get columns via RPC or internal query...');
        // We can't easily get column names without a row if we don't have SQL access.
        // I'll try to insert a dummy row with just a name to see if it works and what it returns.
        const { data: dummy, error: insertError } = await supabase
            .from('catalog_items')
            .insert({ name: 'test_dummy' })
            .select();
        
        if (insertError) {
            console.error('Insert error:', insertError);
        } else {
            console.log('Columns from dummy insert:', Object.keys(dummy[0]));
            // Delete it
            await supabase.from('catalog_items').delete().eq('name', 'test_dummy');
        }
    }
}

checkColumns();
