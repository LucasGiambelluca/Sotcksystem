-- ===========================================
-- MIGRATION: Turnos de Trabajo y Estaciones de Cocina
-- Date: 2026-03-05
-- Description: Crea tablas employees, stations, shifts
--              y relaciona stock_movements con el empleado/turno.
-- ===========================================

-- 1. Empleados
CREATE TABLE IF NOT EXISTS employees (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  role text DEFAULT 'cocinero',       -- cocinero, parrillero, encargado, etc.
  pin_code text,                       -- PIN numérico (4 dígitos) para login rápido
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Estaciones de Trabajo
CREATE TABLE IF NOT EXISTS stations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,                  -- "Parrilla", "Cocina Caliente", "Mesa Fría"
  color text DEFAULT '#3b82f6',        -- Color para UI (badge, borde)
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. Turnos
CREATE TABLE IF NOT EXISTS shifts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id uuid REFERENCES employees(id) ON DELETE RESTRICT NOT NULL,
  station_id uuid REFERENCES stations(id) ON DELETE RESTRICT NOT NULL,
  start_time timestamptz DEFAULT now() NOT NULL,
  end_time timestamptz,
  status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 4. Relacionar stock_movements con turnos y empleados
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES employees(id) ON DELETE SET NULL;

-- 5. Agregar estación a catalog_items para rutear las comandas
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES stations(id) ON DELETE SET NULL;

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_shifts_station ON shifts(station_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_shift ON stock_movements(shift_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_employee ON stock_movements(employee_id);

-- Habilitar Realtime para shifts (para detectar turnos nuevos en cocina)
ALTER PUBLICATION supabase_realtime ADD TABLE shifts;

-- Seed data: estaciones por defecto
INSERT INTO stations (name, color) VALUES
  ('Parrilla', '#ef4444'),
  ('Cocina Caliente', '#f97316'),
  ('Mesa Fría', '#3b82f6')
ON CONFLICT DO NOTHING;

-- Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';
