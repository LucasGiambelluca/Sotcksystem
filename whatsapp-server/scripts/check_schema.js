const { supabase } = require('../src/config/database');
require('dotenv').config();

async function checkSchema() {
    console.log('--- flow_executions schema check ---');
    const { data, error } = await supabase.from('flow_executions').select('*').limit(1);
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    if (!data || data.length === 0) {
        console.log('No sessions found in table.');
        // Try to get column names from information_schema if possible, but usually rpc is easier
    } else {
        console.log('Row sample keys:', Object.keys(data[0]));
    }
}

checkSchema();
