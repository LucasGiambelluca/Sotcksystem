/**
 * Aplica el trigger corregido usando conexión directa a PostgreSQL (Supabase)
 * Uso: node apply_trigger_pg.js
 */
const path = require('path');
require(path.join(__dirname, 'whatsapp-server', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '.env') });
const { Client } = require(path.join(__dirname, 'whatsapp-server', 'node_modules', 'pg'));

// Supabase connection string (formato: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres)
// Podés obtener el password en: Supabase Dashboard > Project Settings > Database > Database password
const connectionString = process.env.DATABASE_URL;

if (!connectionString || connectionString.includes('password')) {
  console.log('⚠️  DATABASE_URL en .env no tiene la contraseña real configurada.');
  console.log('');
  console.log('Para aplicar el trigger, usá uno de estos métodos:');
  console.log('');
  console.log('OPCIÓN 1: Supabase SQL Editor (recomendado)');
  console.log('  1. Logueate en https://supabase.com/dashboard');
  console.log('  2. Abrí tu proyecto > SQL Editor > New query');
  console.log('  3. Pegá el SQL del archivo: supabase/migrations/20260305_recipe_components_and_tasks.sql');
  console.log('  4. Hacé clic en Run');
  console.log('');
  console.log('OPCIÓN 2: Completá el .env');
  console.log('  Editá DATABASE_URL en .env:');
  console.log('  DATABASE_URL=postgresql://postgres:[TU_PASSWORD]@db.bomzcidnpslryfgnrsrs.supabase.co:5432/postgres');
  console.log('  Luego volvé a ejecutar: node apply_trigger_pg.js');
  process.exit(0);
}

const TRIGGER_SQL = `
CREATE OR REPLACE FUNCTION generate_order_station_tasks()
RETURNS TRIGGER AS $$
DECLARE
  item record;
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
        WHERE rc.catalog_item_id = item.catalog_item_id
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

async function apply() {
  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔗 Conectando a PostgreSQL...');
    await client.connect();
    console.log('✅ Conectado. Aplicando migration...');
    await client.query(TRIGGER_SQL);
    console.log('✅ Trigger corregido aplicado exitosamente.');
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await client.end();
  }
}

apply();
