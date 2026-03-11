const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function checkStations() {
    const { data: stations, error } = await supabase
        .from('stations')
        .select('*');
    
    if (error) {
        console.error('Error querying stations:', error);
    } else {
        console.log('Available stations:', stations);
    }
}

checkStations();
