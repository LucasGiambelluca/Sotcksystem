-- Add is_active column to products for Soft Delete pattern
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Ensure index exists for performance
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
