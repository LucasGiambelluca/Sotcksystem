-- Add special offer fields to catalog_items
ALTER TABLE public.catalog_items 
ADD COLUMN IF NOT EXISTS is_special BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS special_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS offer_label TEXT;

-- Create function for massive price updates
CREATE OR REPLACE FUNCTION public.update_all_catalog_prices(p_percentage NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE public.catalog_items
    SET price = price * (1 + (p_percentage / 100.0)),
        updated_at = NOW()
    WHERE id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the public_catalog view to include new fields
DROP VIEW IF EXISTS public.public_catalog CASCADE;
CREATE VIEW public.public_catalog AS
  SELECT
    id,
    name,
    description,
    price,
    category,
    image_url_1,
    image_url_2,
    is_special,
    special_price,
    offer_label,
    (stock > 0 AND is_active = true) AS in_stock
  FROM public.catalog_items
  WHERE is_active = true;

-- Create function for toggling special status
CREATE OR REPLACE FUNCTION public.toggle_catalog_special(p_id UUID, p_is_special BOOLEAN, p_special_price NUMERIC DEFAULT NULL, p_label TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    UPDATE public.catalog_items
    SET is_special = p_is_special,
        special_price = p_special_price,
        offer_label = p_label,
        updated_at = NOW()
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
