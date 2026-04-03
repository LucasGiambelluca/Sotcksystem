-- 1. Actualizar tabla shipping_zones para soportar polígonos y tipos de permiso
ALTER TABLE shipping_zones ADD COLUMN IF NOT EXISTS polygon JSONB;
ALTER TABLE shipping_zones ADD COLUMN IF NOT EXISTS allow_delivery BOOLEAN DEFAULT true;
ALTER TABLE shipping_zones ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Asegurarse que el tipo de zona soporte 'polygon'
-- Nota: Si zone_type es un enum, hay que tener cuidado. Aquí parece ser VARCHAR(20).
-- No hace falta cambiar el tipo, solo el valor que guardaremos.

-- 3. Insertar una zona de ejemplo si no existe nada
INSERT INTO shipping_zones (name, zone_type, max_radius_km, cost, allow_delivery)
SELECT 'Radio General BB', 'radius', 10, 500, true
WHERE NOT EXISTS (SELECT 1 FROM shipping_zones WHERE name = 'Radio General BB');

-- 4. Crear tabla de soporte para barrios si queremos una lista predefinida (opcional)
CREATE TABLE IF NOT EXISTS neighborhoods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    polygon JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para neighborhoods
ALTER TABLE neighborhoods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all" ON neighborhoods FOR SELECT USING (true);
