-- ===========================================
-- MIGRATION: Columnas faltantes de producción y alertas
-- Date: 2026-03-04
-- ===========================================

-- Agregamos las columnas que el formulario de inventario ya
-- estaba enviando pero que no existían en la tabla real.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS min_stock numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_stock numeric DEFAULT 0;

-- Forzamos a que Supabase recargue su caché de columnas para que tome los cambios de inmediato
NOTIFY pgrst, 'reload schema';
