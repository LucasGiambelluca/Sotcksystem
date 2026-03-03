-- Migration: Stock Flow Update
-- Add production_stock and min_stock to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS production_stock integer not null default 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock integer not null default 0;

-- CreateEnum for stock movement types
DO $$ BEGIN
    CREATE TYPE stock_movement_type AS ENUM ('PURCHASE', 'TRANSFER', 'SALE', 'ADJUSTMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id) on delete cascade not null,
  type stock_movement_type not null,
  quantity integer not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast queries on product movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
