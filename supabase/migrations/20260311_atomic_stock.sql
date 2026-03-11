-- Migration to add robust atomic stock decrement for multiple items at once

CREATE OR REPLACE FUNCTION decrement_multiple_stocks(items JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  item JSONB;
  current_stock NUMERIC;
  p_id UUID;
  p_qty NUMERIC;
BEGIN
  -- Loop through each item in the JSON array
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    p_id := (item->>'id')::UUID;
    p_qty := (item->>'qty')::NUMERIC;
    
    -- Lock row to prevent race conditions (FOR UPDATE locks the specific row until transaction ends)
    SELECT stock INTO current_stock 
    FROM catalog_items 
    WHERE id = p_id 
    FOR UPDATE;

    IF current_stock IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', p_id;
    END IF;

    IF current_stock < p_qty THEN
      RAISE EXCEPTION 'Insuficiente stock. Producto: % (Disponible: %, Solicitado: %)', p_id, current_stock, p_qty;
    END IF;

    -- Decrement
    UPDATE catalog_items
    SET 
      stock = stock - p_qty,
      updated_at = NOW()
    WHERE id = p_id;
  END LOOP;

  RETURN TRUE;
END;
$$;
