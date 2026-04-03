-- 1. Crear la función que actualiza el campo updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Asegurarse que la columna existe (por las dudas)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Crear el disparador en la tabla orders
DROP TRIGGER IF EXISTS set_updated_at ON orders;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4. Hacer lo mismo para assignment_orders (repartidores)
ALTER TABLE assignment_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
DROP TRIGGER IF EXISTS set_updated_at_assignment ON assignment_orders;
CREATE TRIGGER set_updated_at_assignment
BEFORE UPDATE ON assignment_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 5. Actualizar todos los registros viejos para que el polling los tome
UPDATE orders SET updated_at = NOW() WHERE updated_at IS NULL;
UPDATE assignment_orders SET updated_at = NOW() WHERE updated_at IS NULL;
