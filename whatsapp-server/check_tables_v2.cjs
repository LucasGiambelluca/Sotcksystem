const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    const tables = ['shifts', 'shift', 'employee_shifts', 'station_shifts'];
    for (const t of tables) {
        const { error } = await supabase.from(t).select('id').limit(1);
        if (error) {
            console.log(`Table ${t}: FAILED (${error.message})`);
        } else {
            console.log(`Table ${t}: EXISTS`);
        }
    }
}
run();
