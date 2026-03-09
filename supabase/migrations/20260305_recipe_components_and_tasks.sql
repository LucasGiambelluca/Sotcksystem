-- ===========================================
-- MIGRATION: Desglose de Comandas por Estaciones
-- Date: 2026-03-05
-- Description: Creates recipe_components (sub-items per station)
--              and order_station_tasks (per-station tickets from orders).
--              Includes trigger to auto-generate tasks on new orders
--              and to auto-complete orders when all tasks are done.
-- ===========================================

-- 1. Recipe Components (Componentes de producción por estación)
-- Ej: catalog_item "Combo Asado" -> component "Asado de tira" (Parrilla), "Guarnición Fritas" (Cocina Caliente)
CREATE TABLE IF NOT EXISTS recipe_components (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,                       -- "Asado de tira", "Porción de Fritas"
  station_id uuid REFERENCES stations(id) ON DELETE SET NULL,
  sort_order integer DEFAULT 0,             -- Para ordenar los componentes visualmente
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipe_components_catalog ON recipe_components(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_components_station ON recipe_components(station_id);

-- 2. Order Station Tasks (Tickets por estación generados de cada pedido)
CREATE TABLE IF NOT EXISTS order_station_tasks (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  station_id uuid REFERENCES stations(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' NOT NULL,   -- 'pending', 'preparing', 'ready'
  items jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{name: "Asado de tira", quantity: 2}, ...]
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ost_order ON order_station_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_ost_station ON order_station_tasks(station_id);
CREATE INDEX IF NOT EXISTS idx_ost_status ON order_station_tasks(status);

-- Enable Realtime for order_station_tasks so station tablets update live
ALTER PUBLICATION supabase_realtime ADD TABLE order_station_tasks;

-- Enable RLS (permissive for now)
ALTER TABLE recipe_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_station_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for all" ON recipe_components FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for all" ON order_station_tasks FOR ALL USING (true) WITH CHECK (true);

-- 3. FUNCTION: Generate station tasks when an order is inserted or updated to 'confirmed'
-- This reads the order's items JSON, looks up recipe_components for each item,
-- and creates one order_station_task per station with the relevant items grouped.
CREATE OR REPLACE FUNCTION generate_order_station_tasks()
RETURNS TRIGGER AS $$
DECLARE
  item jsonb;
  comp record;
  task_map jsonb := '{}';  -- station_id -> [items]
  station_key text;
  existing_tasks integer;
BEGIN
  -- Only generate tasks when the order transitions to 'CONFIRMED'
  IF NEW.status != 'CONFIRMED' THEN
    RETURN NEW;
  END IF;
  
  -- Don't regenerate if tasks already exist for this order
  SELECT COUNT(*) INTO existing_tasks FROM order_station_tasks WHERE order_id = NEW.id;
  IF existing_tasks > 0 THEN
    RETURN NEW;
  END IF;

  -- Iterate over each item in the order
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
      -- Check if this catalog item has recipe_components
      FOR comp IN 
        SELECT rc.name as comp_name, rc.station_id as comp_station_id
        FROM recipe_components rc
        WHERE rc.catalog_item_id = item.catalog_item_id
        ORDER BY rc.sort_order
      LOOP
        has_components := true;
        station_key := comp.comp_station_id::text;
        
        -- Add to task_map for this station
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

      -- Fallback: if no components defined, use the catalog_item's own station_id
      IF NOT has_components THEN
        -- We already fetched the fallback station ID in the main query!
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

  -- Insert one order_station_task per station
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

-- 4. FUNCTION: Auto-complete order when ALL station tasks are 'ready'
CREATE OR REPLACE FUNCTION check_order_completion()
RETURNS TRIGGER AS $$
DECLARE
  total_tasks integer;
  ready_tasks integer;
BEGIN
  IF NEW.status = 'ready' THEN
    -- Update completed_at timestamp
    NEW.completed_at := now();
    
    -- Count total vs ready tasks for this order, EXCLUDING the current one
    -- (since this is a BEFORE trigger, the current row in the DB still has the old status)
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'ready')
    INTO total_tasks, ready_tasks
    FROM order_station_tasks
    WHERE order_id = NEW.order_id AND id != NEW.id;

    -- If all OTHER tasks are ready, then with this one becoming ready, ALL are ready
    IF total_tasks = ready_tasks THEN
      UPDATE orders SET status = 'DELIVERED' WHERE id = NEW.order_id;
    END IF;
  END IF;

  -- If moving to 'preparing', set started_at
  IF NEW.status = 'preparing' AND OLD.status = 'pending' THEN
    NEW.started_at := now();
    -- Also move the parent order to 'IN_PREPARATION' if it's still pending/confirmed
    UPDATE orders SET status = 'IN_PREPARATION' 
    WHERE id = NEW.order_id AND status IN ('PENDING', 'CONFIRMED');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_order_completion ON order_station_tasks;
CREATE TRIGGER trg_check_order_completion
BEFORE UPDATE ON order_station_tasks
FOR EACH ROW EXECUTE FUNCTION check_order_completion();
