-- ===========================================
-- MIGRATION: Separar Inventario de Catálogo de Ventas
-- Date: 2026-03-04
-- Description: Creates catalog_items table for finished/elaborated products
--              sold to customers (e.g., pizza, grilled chicken).
--              The `products` table remains for raw material stock management.
-- ===========================================

-- 1. Create the catalog_items table for sellable/elaborated products
CREATE TABLE IF NOT EXISTS catalog_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text,
  price decimal(10, 2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  category text DEFAULT 'General',
  image_url_1 text,
  image_url_2 text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items(category);
CREATE INDEX IF NOT EXISTS idx_catalog_items_is_active ON catalog_items(is_active);

-- 3. Replace the public_catalog view to use catalog_items instead of products
-- This is the view used by the public-facing Catalog page (/catalog)
CREATE OR REPLACE VIEW public_catalog AS
  SELECT
    id,
    name,
    description,
    price,
    category,
    image_url_1,
    image_url_2,
    (stock > 0 AND is_active = true) AS in_stock
  FROM catalog_items
  WHERE is_active = true
  ORDER BY category, name;

-- 4. Add a column to order_items to reference catalog_items instead of products
-- NOTE: We add as nullable at first to allow gradual migration, then make required.
ALTER TABLE order_items 
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE RESTRICT;

-- 5. Enable Realtime for catalog_items so admin panel updates in real time
ALTER PUBLICATION supabase_realtime ADD TABLE catalog_items;
