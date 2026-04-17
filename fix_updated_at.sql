-- Agregar columna updated_at a la tabla orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Crear índice para mejorar performance de queries
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at);

-- Crear trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Eliminar trigger si existe y crearlo nuevamente
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Actualizar todas las órdenes existentes con updated_at = created_at
UPDATE orders
SET updated_at = created_at
WHERE updated_at IS NULL;
