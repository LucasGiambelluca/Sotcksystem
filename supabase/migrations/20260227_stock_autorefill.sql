-- ============================================
-- MIGRACIÓN: STOCK AUTO-REFILL DIARIO
-- Permite a los productos tener un stock
-- que se repone automáticamente cada día
-- a las 06:00 AM (hora operativa).
-- ============================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS auto_refill BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_refill_qty INTEGER NOT NULL DEFAULT 0;

-- Comentarios descriptivos
COMMENT ON COLUMN products.auto_refill IS 'Si es true, el stock se restaura automáticamente a las 06:00 AM cada día.';
COMMENT ON COLUMN products.auto_refill_qty IS 'Cantidad a la que se restaura el stock si auto_refill = true.';
