-- 1. Enable RLS on core tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if they exist to avoid errors on re-run
DROP POLICY IF EXISTS "Admin full access products" ON products;
DROP POLICY IF EXISTS "Admin full access whatsapp_config" ON whatsapp_config;

-- 3. Create Admin-only policies (authenticated users)
-- In a real app we'd check roles, but assuming any logged-in user is admin:
CREATE POLICY "Admin full access products" 
ON products FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Admin full access whatsapp_config" 
ON whatsapp_config FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. Create the public_catalog view
-- Drops it first to allow recreating with changes
DROP VIEW IF EXISTS public_catalog;

CREATE VIEW public_catalog AS
SELECT 
    id,
    name,
    description,
    price,
    category,
    image_url_1,
    image_url_2,
    (stock > 0) as in_stock
FROM products
WHERE is_active = true;

-- 5. Create the public_branding view
DROP VIEW IF EXISTS public_branding;

CREATE VIEW public_branding AS
SELECT 
    catalog_banner_url,
    catalog_logo_url,
    catalog_business_name,
    catalog_accent_color,
    whatsapp_phone
FROM whatsapp_config
ORDER BY id DESC
LIMIT 1;

-- 6. Grant access to the views to anon (public) role
GRANT SELECT ON public_catalog TO anon;
GRANT SELECT ON public_branding TO anon;
