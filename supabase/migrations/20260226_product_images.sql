-- Add image columns to products table (2 images max per product)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url_1 TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url_2 TEXT;
