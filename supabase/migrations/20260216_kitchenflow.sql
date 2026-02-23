-- ============================================
-- MIGRACIÓN KITCHENFLOW: LOGÍSTICA Y ESTADOS
-- ============================================

-- 1. TABLA: delivery_slots (Franjas horarias)
-- Eliminamos la versión anterior si existe para evitar conflictos de tipos (bigint vs uuid)
DROP TABLE IF EXISTS delivery_slots CASCADE;

CREATE TABLE delivery_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    time_start TIME NOT NULL,
    time_end TIME NOT NULL,
    max_orders INTEGER DEFAULT 5,           -- Capacidad máxima
    orders_count INTEGER DEFAULT 0,         -- Pedidos actuales
    is_available BOOLEAN DEFAULT true,
    cut_off_minutes INTEGER DEFAULT 30,     -- Minutos antes para pedir
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_slots_available ON delivery_slots(date, is_available, time_start) 
WHERE is_available = true AND orders_count < max_orders;

-- 2. MODIFICACIÓN DE TABLA: orders (si no tiene los campos nuevos)
    -- Asegurar tipos de datos correctos para KitchenFlow
    ALTER TABLE orders DROP COLUMN IF EXISTS delivery_slot_id CASCADE;
    ALTER TABLE orders ADD COLUMN delivery_slot_id UUID REFERENCES delivery_slots(id);
    
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number SERIAL;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'NORMAL';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(20) DEFAULT 'DELIVERY';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_to UUID;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_by UUID;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS out_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'PENDING';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS chat_context JSONB;

-- 3. TABLA: order_status_history (Trazabilidad)
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    changed_by UUID,
    changed_via VARCHAR(20),                -- WHATSAPP, WEB, APP, SYSTEM
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TRIGGER PARA HISTORIAL AUTOMÁTICO
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO order_status_history (order_id, from_status, to_status, changed_via)
        VALUES (NEW.id, OLD.status, NEW.status, 'SYSTEM');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_status_change ON orders;
CREATE TRIGGER trg_log_status_change
AFTER UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- 5. TABLA: preparation_queues (Colas de trabajo)
CREATE TABLE IF NOT EXISTS preparation_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,              -- "Cocina", "Barra", "Parrilla"
    description TEXT,
    max_concurrent INTEGER DEFAULT 3,       -- Cuántos pedidos simultáneos
    priority_weight INTEGER DEFAULT 1,      -- Multiplicador de prioridad
    is_active BOOLEAN DEFAULT true,
    active_hours JSONB,                     -- {mon: {start: "10:00", end: "23:00"}, ...}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABLA: users (Preparadores/Repartidores)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(20) NOT NULL,              -- ADMIN, PREPARER, DELIVERY, MANAGER
    assigned_queue_id UUID REFERENCES preparation_queues(id),
    max_orders_simultaneous INTEGER DEFAULT 2,
    is_active BOOLEAN DEFAULT true,
    current_status VARCHAR(20) DEFAULT 'OFFLINE', -- OFFLINE, ONLINE, BUSY, BREAK
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_role CHECK (role IN ('ADMIN', 'PREPARER', 'DELIVERY', 'MANAGER'))
);

-- 7. ACTUALIZAR FKs DE ORDERS (si el campo existía antes pero sin FK)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_assigned_to_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id);

-- 8. VISTA DASHBOARD (Mejorada)
DROP VIEW IF EXISTS orders_dashboard;
CREATE OR REPLACE VIEW orders_dashboard AS
SELECT 
    o.id,
    o.order_number,
    o.phone,
    o.status,
    o.priority,
    o.total_amount,
    o.created_at,
    o.delivery_date,
    u.name as assigned_to_name,
    COUNT(oi.id) as items_count,
    SUM(oi.quantity) as total_items
FROM orders o
LEFT JOIN users u ON o.assigned_to = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.status NOT IN ('DELIVERED', 'CANCELLED')
GROUP BY o.id, u.id;

-- 9. SEGURIDAD Y RLS
ALTER TABLE delivery_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE preparation_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso público para Service Role y desarrollo (Ajustar en Prod real)
CREATE POLICY "Enable all for all" ON delivery_slots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for all" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for all" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for all" ON order_status_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for all" ON preparation_queues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for all" ON users FOR ALL USING (true) WITH CHECK (true);

