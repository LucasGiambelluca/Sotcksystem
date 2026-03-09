-- ===========================================
-- MIGRATION: Sanitize Schema for Production
-- Date: 2026-03-06
-- Description: Makes product_id nullable on order_items to support
--              the transition to catalog_item_id as the primary reference.
-- ===========================================

-- 1. Drop NOT NULL constraint on product_id
-- This allows orders to be created using only catalog_item_id
ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;

-- 2. Make catalog_item_id NOT NULL for new data integrity
-- (Only enable this AFTER all existing rows have been backfilled)
-- ALTER TABLE order_items ALTER COLUMN catalog_item_id SET NOT NULL;

-- 3. Add index on catalog_item_id for query performance (trigger joins on this)
CREATE INDEX IF NOT EXISTS idx_order_items_catalog_item_id ON order_items(catalog_item_id);
