-- Agrega las columnas de configuración del catálogo a whatsapp_config si no existen
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_banner_url TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_logo_url TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_business_name TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_accent_color TEXT DEFAULT '#dc2626';
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
