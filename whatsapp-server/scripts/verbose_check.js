const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('--- DB Check ---');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_KEY Length:', process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.length : 0);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    try {
        const { data: products, error } = await supabase.from('products').select('*');
        if (error) {
            console.error('❌ Query Error:', error.message);
            return;
        }
        console.log('✅ Total products found:', products.length);
        const active = products.filter(p => p.is_active);
        console.log('✅ Active products:', active.length);
        
        if (active.length > 0) {
            console.log('Sample Active:', {
                id: active[0].id,
                name: active[0].name,
                is_active: active[0].is_active,
                synonyms: active[0].synonyms
            });
        }

        const { data: executions, error: e2 } = await supabase.from('flow_executions').select('updated_at').limit(1);
        console.log('✅ flow_executions.updated_at check:', e2 ? `MISSING (${e2.message})` : 'EXISTS');

    } catch (err) {
        console.error('❌ Fatal Error:', err.message);
    }
}

check();
