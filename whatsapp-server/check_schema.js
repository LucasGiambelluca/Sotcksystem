require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('--- VERIFICANDO SCHEMAS DE TABLAS ---');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql: `
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_name IN ('assignments', 'assignment_orders', 'cadete_metadata', 'cadete_locations')
    ` });
    
    if (error) {
        // Fallback if no exec_sql
        console.log('No se pudo usar exec_sql. Probando inspección manual...');
        const tables = ['assignments', 'assignment_orders', 'cadete_metadata', 'cadete_locations'];
        for (const t of tables) {
            const { data: check } = await supabase.from(t).select('id').limit(1);
            console.log(`Tabla '${t}': ${check ? 'ACCESIBLE' : 'NO ACCESIBLE'}`);
        }
    } else {
        console.table(data);
    }
    
    console.log('\n--- VERIFICANDO URL DEL PROYECTO ---');
    console.log('URL actual en .env:', supabaseUrl);
    
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
