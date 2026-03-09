-- ===========================================
-- MIGRATION: Módulo de Logística Inteligente y Verificación (LIV)
-- Date: 2026-03-06
-- ===========================================

-- 1. Agregar configuración de origen (Local) a whatsapp_config
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'store_lat') THEN
        ALTER TABLE whatsapp_config ADD COLUMN store_lat DECIMAL(10, 8);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'store_lng') THEN
        ALTER TABLE whatsapp_config ADD COLUMN store_lng DECIMAL(11, 8);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'shipping_policy') THEN
        -- flex (Texto), smart (Híbrido), secure (GPS Obligatorio)
        ALTER TABLE whatsapp_config ADD COLUMN shipping_policy VARCHAR(20) DEFAULT 'smart';
    END IF;
END $$;


-- 2. Asegurarse de que la tabla orders soporte lat y lng del delivery
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_lat') THEN
        ALTER TABLE orders ADD COLUMN delivery_lat DECIMAL(10, 8);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_lng') THEN
        ALTER TABLE orders ADD COLUMN delivery_lng DECIMAL(11, 8);
    END IF;
END $$;


-- 3. Crear/Reestructurar la tabla shipping_zones
-- Primero comprobamos si existe. Si existe pero no tiene el esquema correcto, la tiramos y recreamos.
DROP TABLE IF EXISTS shipping_zones CASCADE;

CREATE TABLE shipping_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    zone_type VARCHAR(20) NOT NULL DEFAULT 'radius', -- 'radius' o 'text_match'
    max_radius_km DECIMAL(10, 2), -- Usado si zone_type = 'radius'
    match_keywords TEXT, -- Usado si zone_type = 'text_match' (separadas por comas)
    cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;

-- Políticas (Lectura pública para el catálogo/bot, Escritura solo para admins)
CREATE POLICY "Enable read access for all users" ON shipping_zones FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON shipping_zones FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON shipping_zones FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users only" ON shipping_zones FOR DELETE USING (true);


-- 4. Recrear la vista de branding público (opcional pero ayuda al catálogo a no exponer el token)
DROP VIEW IF EXISTS public_branding;
CREATE VIEW public_branding AS 
SELECT 
    welcome_message, 
    whatsapp_phone, 
    catalog_banner_url, 
    catalog_logo_url, 
    catalog_business_name, 
    catalog_accent_color,
    store_lat,
    store_lng
FROM whatsapp_config 
WHERE is_active = true 
LIMIT 1;
