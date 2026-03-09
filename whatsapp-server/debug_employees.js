require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('--- REVISANDO EMPLEADOS ---');
    const { data: employees, error } = await supabase
      .from('employees')
      .select('id, name, role, is_active');
    
    if (error) {
      console.error('Error fetching employees:', error);
      return;
    }

    if (!employees || employees.length === 0) {
      console.log('No se encontraron empleados en la tabla.');
    } else {
      console.table(employees);
      const cadetes = employees.filter(e => e.role === 'cadete' || e.role === 'delivery');
      console.log(`Cadetes/Delivery encontrados: ${cadetes.length}`);
    }
  } catch (err) {
    console.error('Error inesperado:', err);
  }
}

main();
