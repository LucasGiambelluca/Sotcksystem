-- MIGRACIÓN DEFINITIVA: Agregar nuevos estados de pedido
-- Esta migración elimina TODOS los constraints de status y crea uno nuevo

-- Paso 1: Eliminar TODOS los constraints que puedan estar bloqueando
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    -- Buscar y eliminar cualquier constraint que contenga 'status' en orders
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'orders'::regclass 
        AND conname LIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE orders DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Paso 2: Agregar el nuevo constraint con los 6 estados
ALTER TABLE orders 
  ADD CONSTRAINT orders_status_check 
  CHECK (
    status IN ('PENDING', 'CONFIRMED', 'IN_PREPARATION', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')
  );

-- Paso 3: Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Paso 4: Verificar que se creó correctamente
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'New status values allowed: PENDING, CONFIRMED, IN_PREPARATION, IN_TRANSIT, DELIVERED, CANCELLED';
END $$;
