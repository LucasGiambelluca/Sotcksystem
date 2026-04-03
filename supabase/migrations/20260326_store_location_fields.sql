-- Migración para persistir detalles de ubicación del local
ALTER TABLE whatsapp_config 
ADD COLUMN IF NOT EXISTS store_address TEXT,
ADD COLUMN IF NOT EXISTS store_city TEXT DEFAULT 'Bahía Blanca',
ADD COLUMN IF NOT EXISTS store_province TEXT DEFAULT 'Buenos Aires',
ADD COLUMN IF NOT EXISTS store_country TEXT DEFAULT 'Argentina';

-- Actualizar registros existentes con valores por defecto para evitar errores
UPDATE whatsapp_config 
SET store_city = 'Bahía Blanca', 
    store_province = 'Buenos Aires', 
    store_country = 'Argentina'
WHERE store_city IS NULL;
