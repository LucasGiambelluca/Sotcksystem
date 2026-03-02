-- 1. Agregar columnas necesarias a products y whatsapp_config
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url_1 TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url_2 TEXT;

ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_banner_url TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_logo_url TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_business_name TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_accent_color TEXT DEFAULT '#dc2626';
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

-- 2. Activar Seguridad a Nivel de Fila (RLS) en las tablas originales
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

-- 3. Limpiar políticas previas por si reejecutamos
DROP POLICY IF EXISTS "Admin full access products" ON products;
DROP POLICY IF EXISTS "Admin full access whatsapp_config" ON whatsapp_config;

-- 4. Crear políticas para el administrador (login) para que pueda seguir usando el panel
CREATE POLICY "Admin full access products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access whatsapp_config" ON whatsapp_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Crear Vista de Catálogo (solo expone columnas seguras y el flag in_stock)
DROP VIEW IF EXISTS public_catalog;
CREATE VIEW public_catalog AS
SELECT id, name, description, price, category, image_url_1, image_url_2, (stock > 0) as in_stock
FROM products
WHERE is_active = true;

-- 6. Crear Vista de Branding (solo expone nombre, logo, colores y número WA)
DROP VIEW IF EXISTS public_branding;
CREATE VIEW public_branding AS
SELECT catalog_banner_url, catalog_logo_url, catalog_business_name, catalog_accent_color, whatsapp_phone
FROM whatsapp_config
ORDER BY id DESC LIMIT 1;

-- 7. Dar permisos de lectura al público (anon) SOLO para las Vistas (no para las tablas)
GRANT SELECT ON public_catalog TO anon;
GRANT SELECT ON public_branding TO anon;
