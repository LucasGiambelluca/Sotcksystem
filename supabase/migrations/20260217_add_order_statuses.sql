-- Add new order statuses: IN_PREPARATION and IN_TRANSIT
-- This allows tracking the full order lifecycle

-- First, drop the existing constraint if it exists
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the new constraint with all statuses
-- Note: PostgreSQL text comparison is case-sensitive, so we use exact values
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status::text IN ('PENDING', 'CONFIRMED', 'IN_PREPARATION', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'));

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
