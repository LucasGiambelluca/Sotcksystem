-- ===========================================
-- MIGRATION: Campos de Insumos para Inventario
-- Date: 2026-03-04
-- Description: Agrega campos orientados a la cadena de suministro
--              (costo, proveedor, fecha ingreso) a la tabla products
--              ya que ahora es exclusiva para materia prima.
-- ===========================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS last_restock_date date;

-- Las columnas image_url_1 y image_url_2 quedan obsoletas para el inventario,
-- pero las dejamos para evitar romper historiales. Simplemente el frontend
-- dejará de usarlas/pedirlas.
