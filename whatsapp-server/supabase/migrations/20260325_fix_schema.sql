-- Add is_deleted column to products and catalog_items
-- This fixes the [StockCron] error and potentially the public catalog visibility

-- 1. Update products table
ALTER TABLE IF EXISTS products 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 2. Update catalog_items table
ALTER TABLE IF EXISTS catalog_items 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 3. Recreate public_catalog view if it exists and depends on products/catalog_items
-- Assuming the view uses SELECT * or has specific filters that might be affected
-- Let's just make sure the columns are there for now.

COMMENT ON COLUMN products.is_deleted IS 'Soft delete flag for inventory products';
COMMENT ON COLUMN catalog_items.is_deleted IS 'Soft delete flag for catalog items';
