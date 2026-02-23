-- SIMPLIFIED ORDER STATUS MIGRATION
-- Run this in Supabase SQL Editor

-- Step 1: Drop the constraint (if it exists)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Step 2: Add the new constraint with all 6 statuses
-- Using a simpler approach without ::text cast
ALTER TABLE orders 
  ADD CONSTRAINT orders_status_check 
  CHECK (
    status = 'PENDING' OR 
    status = 'CONFIRMED' OR 
    status = 'IN_PREPARATION' OR 
    status = 'IN_TRANSIT' OR 
    status = 'DELIVERED' OR 
    status = 'CANCELLED'
  );

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Step 4: Verify the constraint was created
-- Run this query to check:
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'orders'::regclass AND conname = 'orders_status_check';
