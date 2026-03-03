-- Replace product stock decrement to use production_stock

CREATE OR REPLACE FUNCTION decrement_product_stock(p_id UUID, p_qty INT)
RETURNS void AS $$
BEGIN
    UPDATE products
    SET production_stock = GREATEST(0, production_stock - p_qty)
    WHERE id = p_id;
    
    -- Register the SALE movement taking from production stock
    INSERT INTO stock_movements (product_id, type, quantity, description)
    VALUES (p_id, 'SALE', p_qty, 'Venta (Pedido Creado)');
END;
$$ LANGUAGE plpgsql;
