require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    const tables = ['assignments', 'assignment_orders', 'cadete_metadata', 'cadete_locations'];
    console.log('--- VERIFICANDO TABLAS LOGÍSTICA V2 ---');
    
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      if (error) {
        console.log(`❌ Table '${table}': ERROR - ${error.message} (${error.code})`);
      } else {
        console.log(`✅ Table '${table}': EXISTE`);
      }
    }
  } catch (err) {
    console.error('Error inesperado:', err);
  }
}

main();
