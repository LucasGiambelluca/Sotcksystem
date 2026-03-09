require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('--- REVISANDO ESTACIONES ---');
    const { data: stations, error } = await supabase
      .from('stations')
      .select('id, name');
    
    if (error) {
      console.error('Error fetching stations:', error);
      return;
    }

    if (!stations || stations.length === 0) {
      console.log('No hay estaciones. Creando estación "Reparto" por defecto...');
      const { data: newStation, error: createError } = await supabase
        .from('stations')
        .insert({ name: 'Reparto', color: '#db2777', is_active: true })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creando estación:', createError);
      } else {
        console.log('Estación "Reparto" creada con ID:', newStation.id);
      }
    } else {
      console.table(stations);
    }
  } catch (err) {
    console.error('Error inesperado:', err);
  }
}

main();
