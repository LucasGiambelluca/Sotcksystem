-- MIGRACIÓN FINAL: Modificar ENUM de status (si existe) o crear constraint
-- Esta migración maneja ambos casos: ENUM o VARCHAR

DO $$ 
DECLARE
    column_type text;
    enum_name text;
BEGIN
    -- Verificar el tipo de la columna status
    SELECT data_type, udt_name INTO column_type, enum_name
    FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'status';
    
    RAISE NOTICE 'Column type: %, UDT: %', column_type, enum_name;
    
    -- Si es un ENUM, necesitamos agregar los nuevos valores
    IF column_type = 'USER-DEFINED' THEN
        RAISE NOTICE 'Status is an ENUM type, adding new values...';
        
        -- Agregar nuevos valores al ENUM si no existen
        BEGIN
            ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'IN_PREPARATION';
        EXCEPTION WHEN duplicate_object THEN
            RAISE NOTICE 'IN_PREPARATION already exists in enum';
        END;
        
        BEGIN
            ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
        EXCEPTION WHEN duplicate_object THEN
            RAISE NOTICE 'IN_TRANSIT already exists in enum';
        END;
        
    ELSE
        RAISE NOTICE 'Status is VARCHAR/TEXT, managing with CHECK constraint...';
        
        -- Eliminar constraints existentes
        EXECUTE (
            SELECT string_agg('ALTER TABLE orders DROP CONSTRAINT ' || quote_ident(conname) || ';', ' ')
            FROM pg_constraint
            WHERE conrelid = 'orders'::regclass AND conname LIKE '%status%'
        );
        
        -- Crear nuevo constraint
        ALTER TABLE orders 
          ADD CONSTRAINT orders_status_check 
          CHECK (status IN ('PENDING', 'CONFIRMED', 'IN_PREPARATION', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'));
    END IF;
    
    -- Crear índice
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    
    RAISE NOTICE '✅ Migration completed successfully!';
END $$;
