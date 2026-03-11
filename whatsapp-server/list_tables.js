const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function listTables() {
    const { data, error } = await supabase.rpc('get_tables'); // Hope there is an RPC for this or use a query if allowed
    if (error) {
        // Fallback: try to query information_schema if allowed via RPC or direct
        console.log('RPC get_tables failed. Trying direct query...');
        const { data: tables, error: tableError } = await supabase.from('flows').select('id').limit(1); // Just checking connectivity
        if (tableError) console.error('Connection error:', tableError);
        
        // Let's try to find common table names by trial and error if we can't list
        const commonNames = ['nodes', 'flow_nodes', 'workflow_nodes', 'steps', 'conversion_nodes'];
        for (const name of commonNames) {
            const { error: testError } = await supabase.from(name).select('count').limit(1);
            if (!testError) {
                console.log(`Found table: ${name}`);
            }
        }
    } else {
        console.log('Tables:', data);
    }
}

listTables();
