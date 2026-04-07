const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zmwzwdgmjrlxtwcwxhhn.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptd3p3ZGdtanJseHR3Y3d4aGhuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAyNTg4MSwiZXhwIjoyMDg5NjAxODgxfQ.gYQ5UXEKqWePvP5JPVGWnQ0jQKlqLpXFYDR77oSSq_c';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
    const { data, count, error } = await supabase
        .from('catalog_items')
        .select('*', { count: 'exact' });
    
    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Current items in catalog_items: ${count}`);
    const categories = [...new Set(data.map(item => item.category))];
    console.log('Categories:', categories);
}

check();
