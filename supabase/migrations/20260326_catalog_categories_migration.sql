-- 1. Create catalog_categories table
CREATE TABLE IF NOT EXISTS public.catalog_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add category_id to catalog_items
ALTER TABLE public.catalog_items 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.catalog_categories(id);

-- 3. Update public_catalog view to include category info
DROP VIEW IF EXISTS public.public_catalog CASCADE;
CREATE VIEW public.public_catalog AS
  SELECT
    ci.id,
    ci.name,
    ci.description,
    ci.price,
    COALESCE(cc.name, ci.category, 'General') AS category,
    ci.category_id,
    cc.name as category_name,
    cc.sort_order as category_sort_order,
    ci.sort_order as item_sort_order,
    ci.image_url_1,
    ci.image_url_2,
    ci.is_special,
    ci.special_price,
    ci.offer_label,
    (ci.stock > 0 AND ci.is_active = true) AS in_stock
  FROM public.catalog_items ci
  LEFT JOIN public.catalog_categories cc ON ci.category_id = cc.id
  WHERE ci.is_active = true;

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_categories;

-- 5. RLS Policies
ALTER TABLE public.catalog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only access to categories"
ON public.catalog_categories FOR SELECT
USING (true);

CREATE POLICY "Allow service_role full access to categories"
ON public.catalog_categories
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
