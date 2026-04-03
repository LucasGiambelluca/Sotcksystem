-- 1. Cambiar columna quantity a numeric para permitir 0.5, 1.5, etc. en pedidos
ALTER TABLE order_items ALTER COLUMN quantity TYPE NUMERIC;

-- 2. Asegurarse que order_draft_items también lo permita si existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_draft_items') THEN
        ALTER TABLE order_draft_items ALTER COLUMN quantity TYPE NUMERIC;
    END IF;
END $$;

-- 3. Recrear la función de descuento de stock con soporte para NUMERIC (evita errores de tipo)
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
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    p_id := (item->>'id')::UUID;
    p_qty := (item->>'qty')::NUMERIC;
    
    SELECT stock INTO current_stock 
    FROM catalog_items 
    WHERE id = p_id 
    FOR UPDATE;

    IF current_stock IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado: %', p_id;
    END IF;

    IF current_stock < p_qty THEN
      RAISE EXCEPTION 'Insuficiente stock para % (Disponible: %, Solicitado: %)', p_id, current_stock, p_qty;
    END IF;

    UPDATE catalog_items
    SET 
      stock = stock - p_qty,
      updated_at = NOW()
    WHERE id = p_id;
  END LOOP;

  RETURN TRUE;
END;
$$;
