-- Migration to allow inactive products to stay in the catalog view instead of being filtered out.
-- This prevents products from "disappearing" when they are marked as unavailable.
-- They will instead show as "out of stock" (in_stock = false).

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
    (stock > 0 AND is_active = true) AS in_stock,
    sort_order,
    category_id,
    is_active
  FROM public.catalog_items
  ORDER BY category, sort_order, name;
