-- Update catalog prices with support for fixed amounts and category filtering
CREATE OR REPLACE FUNCTION public.update_catalog_prices_v2(
    p_percentage NUMERIC DEFAULT 0,
    p_fixed_amount NUMERIC DEFAULT 0,
    p_category TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.catalog_items
    SET price = (CASE 
                    WHEN p_percentage != 0 THEN price * (1 + (p_percentage / 100.0))
                    WHEN p_fixed_amount != 0 THEN price + p_fixed_amount
                    ELSE price
                 END),
        updated_at = NOW()
    WHERE (p_category IS NULL OR category = p_category);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
