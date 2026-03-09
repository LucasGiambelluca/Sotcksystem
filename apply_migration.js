/**
 * Aplica la migración del trigger corregido a la DB de Supabase
 * usando el REST API (sin necesidad de conexión directa PostgreSQL).
 * 
 * Uso: node apply_migration.js
 */
const path = require('path');
require(path.join(__dirname, 'whatsapp-server', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '.env') });
const { createClient } = require(path.join(__dirname, 'whatsapp-server', 'node_modules', '@supabase', 'supabase-js'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// SQL para recrear el trigger correctamente
const FIXED_TRIGGER_SQL = `
-- Función corregida: usa catalog_item_id en lugar de product_id para catalog_items
CREATE OR REPLACE FUNCTION generate_order_station_tasks()
RETURNS TRIGGER AS $$
DECLARE
  item jsonb;
  comp record;
  task_map jsonb := '{}';
  station_key text;
  existing_tasks integer;
BEGIN
  IF NEW.status != 'CONFIRMED' THEN
    RETURN NEW;
  END IF;
  
  SELECT COUNT(*) INTO existing_tasks FROM order_station_tasks WHERE order_id = NEW.id;
  IF existing_tasks > 0 THEN
    RETURN NEW;
  END IF;

  FOR item IN 
    SELECT oi.quantity as qty, COALESCE(ci.name, p.name) as name, ci.station_id as catalog_station_id, oi.catalog_item_id
    FROM order_items oi
    LEFT JOIN catalog_items ci ON ci.id = oi.catalog_item_id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
  LOOP
    DECLARE
      item_name text := item.name;
      item_qty integer := item.qty;
      has_components boolean := false;
      fallback_station_id uuid;
    BEGIN
      FOR comp IN 
        SELECT rc.name as comp_name, rc.station_id as comp_station_id
        FROM recipe_components rc
        WHERE rc.catalog_item_id = (item->>'catalog_item_id')::uuid
        ORDER BY rc.sort_order
      LOOP
        has_components := true;
        station_key := comp.comp_station_id::text;
        
        IF task_map ? station_key THEN
          task_map := jsonb_set(
            task_map, 
            ARRAY[station_key], 
            (task_map->station_key) || jsonb_build_object('name', comp.comp_name, 'quantity', item_qty, 'parent_item', item_name)
          );
        ELSE
          task_map := jsonb_set(
            task_map, 
            ARRAY[station_key], 
            jsonb_build_array(jsonb_build_object('name', comp.comp_name, 'quantity', item_qty, 'parent_item', item_name))
          );
        END IF;
      END LOOP;

      IF NOT has_components THEN
        fallback_station_id := item.catalog_station_id;

        IF fallback_station_id IS NOT NULL THEN
          station_key := fallback_station_id::text;
          IF task_map ? station_key THEN
            task_map := jsonb_set(
              task_map, 
              ARRAY[station_key], 
              (task_map->station_key) || jsonb_build_object('name', item_name, 'quantity', item_qty)
            );
          ELSE
            task_map := jsonb_set(
              task_map, 
              ARRAY[station_key], 
              jsonb_build_array(jsonb_build_object('name', item_name, 'quantity', item_qty))
            );
          END IF;
        END IF;
      END IF;
    END;
  END LOOP;

  FOR station_key IN SELECT * FROM jsonb_object_keys(task_map)
  LOOP
    INSERT INTO order_station_tasks (order_id, station_id, items, status)
    VALUES (NEW.id, station_key::uuid, task_map->station_key, 'pending');
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_station_tasks ON orders;
CREATE TRIGGER trg_generate_station_tasks
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION generate_order_station_tasks();
`;

async function applyMigration() {
  console.log('🔧 Aplicando migración del trigger corregido...\n');
  
  // Supabase JS client no puede ejecutar SQL arbitrario con anon key
  // Necesitamos usar la función RPC o el endpoint de administración.
  // Intentamos via rpc('exec_sql') si existe, sino mostramos instrucciones.
  
  const { data, error } = await supabase.rpc('exec_sql', { sql: FIXED_TRIGGER_SQL });
  
  if (error) {
    if (error.message.includes('exec_sql') || error.code === 'PGRST202') {
      console.log('⚠️  La función exec_sql no existe. Necesitás aplicar el SQL manualmente en el dashboard de Supabase.');
      console.log('\n📋 Pasos para aplicar el trigger corregido:\n');
      console.log('1. Abrí: https://supabase.com/dashboard/project/bomzcidnpslryfgnrsrs/sql');
      console.log('2. Pegá el siguiente SQL y ejecutalo:\n');
      console.log('──────────────────────────────────────────────────────────────');
      console.log(FIXED_TRIGGER_SQL);
      console.log('──────────────────────────────────────────────────────────────');
    } else {
      console.error('❌ Error aplicando migración:', error);
    }
    return false;
  }
  
  console.log('✅ Migración aplicada correctamente.');
  return true;
}

applyMigration();
