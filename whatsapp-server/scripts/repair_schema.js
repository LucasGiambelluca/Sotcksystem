const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function repair() {
    console.log('--- DB Repair: synonyms column ---');
    
    // Check if column exists
    const { data, error } = await supabase.from('catalog_items').select('id, name').limit(1);
    if (error) {
        console.error('Error selecting from catalog_items:', error.message);
        return;
    }

    console.log('Table catalog_items exists. Attempting to add synonyms column...');

    const sql = `
        ALTER TABLE catalog_items 
        ADD COLUMN IF NOT EXISTS synonyms text[] DEFAULT '{}';
    `;

    // Try multiple ways to execute SQL if exec_sql is restricted
    try {
        const { error: rpcError } = await supabase.rpc('exec_sql', { sql });
        if (rpcError) {
            console.error('RPC exec_sql failed:', rpcError.message);
            console.log('Trying alternative: check if it already exists by attempting a select');
            const { error: selectError } = await supabase.from('catalog_items').select('synonyms').limit(1);
            if (!selectError) {
                console.log('✅ synonyms column actually exists already!');
            } else {
                console.log('❌ Still missing. Manual intervention in Supabase Dashboard required.');
            }
        } else {
            console.log('✅ Column added successfully via RPC!');
        }
    } catch (e) {
        console.error('Exception during RPC:', e.message);
    }
}

repair();
