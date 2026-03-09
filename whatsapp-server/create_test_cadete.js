require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('--- CREANDO CADETES DE PRUEBA ---');
    const testCadetes = [
      { name: 'Juan Repartidor', role: 'cadete', is_active: true },
      { name: 'Santi Moto', role: 'cadete', is_active: true }
    ];

    for (const cadete of testCadetes) {
        const { data: existing } = await supabase
            .from('employees')
            .select('id')
            .eq('name', cadete.name)
            .limit(1)
            .maybeSingle();
        
        if (existing) {
            console.log(`Cadete '${cadete.name}' ya existe.`);
        } else {
            const { data, error } = await supabase
                .from('employees')
                .insert(cadete)
                .select()
                .single();
            
            if (error) {
                console.error(`Error creando a ${cadete.name}:`, error);
            } else {
                console.log(`Cadete '${cadete.name}' creado con ID: ${data.id}`);
            }
        }
    }
  } catch (err) {
    console.error('Error inesperado:', err);
  }
}

main();
