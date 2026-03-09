-- ===========================================
-- MIGRATION: Row Level Security (RLS) Policies
-- Date: 2026-03-06
-- Description: Enables RLS on critical tables and creates access policies.
--              The WhatsApp bot uses SERVICE_ROLE_KEY which bypasses RLS.
--              The admin panel uses authenticated users (via Supabase Auth).
--              The public catalog is read-only for anonymous users.
-- ===========================================

-- ═══════════════════════════════════════
-- 1. CATALOG ITEMS (Public read, admin write)
-- ═══════════════════════════════════════
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

-- Public: anyone can read active catalog items
CREATE POLICY "catalog_items_public_read" ON catalog_items
  FOR SELECT USING (is_active = true);

-- Admin: authenticated users can do everything
CREATE POLICY "catalog_items_admin_all" ON catalog_items
  FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════
-- 2. ORDERS (Admin only, bot uses service key)
-- ═══════════════════════════════════════
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_admin_all" ON orders
  FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════
-- 3. ORDER ITEMS (Admin only)
-- ═══════════════════════════════════════
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_admin_all" ON order_items
  FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════
-- 4. STATIONS (Admin read/write, public read for tablet displays)
-- ═══════════════════════════════════════
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stations_public_read" ON stations
  FOR SELECT USING (is_active = true);

CREATE POLICY "stations_admin_all" ON stations
  FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════
-- 5. ORDER STATION TASKS (Admin + public read for kitchen tablets)
-- ═══════════════════════════════════════
ALTER TABLE order_station_tasks ENABLE ROW LEVEL SECURITY;

-- Kitchen tablets can read and update their tasks
CREATE POLICY "station_tasks_public_read" ON order_station_tasks
  FOR SELECT USING (true);

CREATE POLICY "station_tasks_public_update" ON order_station_tasks
  FOR UPDATE USING (true);

CREATE POLICY "station_tasks_admin_all" ON order_station_tasks
  FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════
-- 6. RECIPE COMPONENTS (Admin only)
-- ═══════════════════════════════════════
ALTER TABLE recipe_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipe_components_admin_all" ON recipe_components
  FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════
-- 7. CLIENTS (Admin only, bot uses service key)
-- ═══════════════════════════════════════
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_admin_all" ON clients
  FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════
-- 8. PRODUCTS / RAW MATERIALS (Admin only)
-- ═══════════════════════════════════════
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_admin_all" ON products
  FOR ALL USING (auth.role() = 'authenticated');
