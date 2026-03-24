const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    console.log('Inserting test cadete...');
    const { data, error } = await supabase.from('employees').insert({
        name: 'Cadete de Prueba',
        role: 'cadete',
        is_active: true
    }).select();

    if (error) {
        console.error('ERROR:', error);
    } else {
        console.log('INSERTED:', data);
    }
}
run();
