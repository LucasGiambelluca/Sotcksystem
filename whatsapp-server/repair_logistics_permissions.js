require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const SQL = `
GRANT ALL ON TABLE assignments TO anon, authenticated, service_role;
GRANT ALL ON TABLE assignment_orders TO anon, authenticated, service_role;
GRANT ALL ON TABLE cadete_metadata TO anon, authenticated, service_role;
GRANT ALL ON TABLE cadete_locations TO anon, authenticated, service_role;

ALTER TABLE assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE cadete_metadata DISABLE ROW LEVEL SECURITY;
ALTER TABLE cadete_locations DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
`;

async function main() {
  console.log('--- INTENTANDO REPARAR PERMISOS VÍA RPC ---');
  const { data, error } = await supabase.rpc('exec_sql', { sql: SQL });
  
  if (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('exec_sql')) {
        console.log('💡 La función exec_sql no está disponible.');
    }
  } else {
    console.log('✅ Permisos y RLS actualizados correctamente.');
  }
}

main();
