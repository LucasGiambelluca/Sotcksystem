-- Migration: Create tables for Hybrid Flow Engine
-- Description: Stores visual flow definitions and execution state

-- 1. Table: flows (The definition of a flow)
CREATE TABLE IF NOT EXISTS flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_word VARCHAR(100), -- e.g. "hola", "menu"
    trigger_type VARCHAR(20) DEFAULT 'exact', -- 'exact', 'contains', 'regex'
    is_active BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false, -- If no trigger matches, use this
    
    -- Visual Editor Data (React Flow)
    nodes JSONB DEFAULT '[]'::jsonb,
    edges JSONB DEFAULT '[]'::jsonb,
    viewport JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by trigger
CREATE INDEX IF NOT EXISTS idx_flows_trigger ON flows(trigger_word) WHERE is_active = true;

-- 2. Table: flow_executions (State of a user in a flow)
CREATE TABLE IF NOT EXISTS flow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
    phone VARCHAR(50) NOT NULL,
    
    current_node_id VARCHAR(100), -- The ID of the node in the JSON
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'error'
    
    context JSONB DEFAULT '{}'::jsonb, -- Variables gathered (name, order items, etc)
    
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for looking up active sessions
CREATE INDEX IF NOT EXISTS idx_flow_executions_active ON flow_executions(phone) WHERE status = 'active';

-- Support for RLS (Optional, likely needed for Supabase)
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_executions ENABLE ROW LEVEL SECURITY;

-- Allow public access for now (or Service Role will bypass this)
CREATE POLICY "Enable all access for service role" ON flows
    FOR ALL USING (true) WITH CHECK (true);
    
CREATE POLICY "Enable all access for service role" ON flow_executions
    FOR ALL USING (true) WITH CHECK (true);
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

-- Migration: Create Professional Tickets table
-- Description: Stores rich ticket data including SLA, Context, and Priority.

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identification
    phone VARCHAR(50) NOT NULL,
    customer_name VARCHAR(100),
    
    -- Content
    subject VARCHAR(200),            -- Summary/Title
    description TEXT,                -- Full details
    category VARCHAR(50),            -- 'producto', 'servicio', 'pagos', 'envios', 'otro'
    priority VARCHAR(20) DEFAULT 'medium',   -- 'low', 'medium', 'high', 'critical'
    
    -- Context (Critical for Bot)
    flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
    node_id VARCHAR(100),
    context_snapshot JSONB DEFAULT '{}'::jsonb, -- Store cart, variables at moment of creation
    last_message TEXT,
    
    -- Management
    status VARCHAR(20) DEFAULT 'open',       -- 'open', 'in_progress', 'resolved', 'closed'
    assigned_to UUID,                        -- Agent ID (Link to auth.users if using Supabase Auth, or just string if external)
    resolution_notes TEXT,
    
    -- SLA / Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    due_at TIMESTAMP WITH TIME ZONE,         -- Deadline
    
    -- Loop Closure
    customer_notified BOOLEAN DEFAULT false
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_phone ON tickets(phone);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);

-- Enable Realtime for this table (Check Supabase Dashboard to confirm 'tickets' is in published tables, but RLS/Policies enable access)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Policies (Adjust based on your Auth setup)
CREATE POLICY "Enable read/write for verified users" ON tickets
    FOR ALL USING (true) WITH CHECK (true); -- Public/Service Role for now.
-- Add notification templates to whatsapp_config
-- Using safe ALTERS to avoid errors if columns already exist

DO $$
BEGIN
    -- CONFIRMED
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'template_confirmed') THEN
        ALTER TABLE whatsapp_config ADD COLUMN template_confirmed TEXT DEFAULT '✅ *Pedido Confirmado*

Hola {clientName}! Tu pedido ha sido confirmado.

📦 Pedido: #{orderId}
💰 Total: ${total}
{deliveryDate}

Te avisaremos cuando comencemos a prepararlo.';
    END IF;

    -- IN_PREPARATION
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'template_preparation') THEN
        ALTER TABLE whatsapp_config ADD COLUMN template_preparation TEXT DEFAULT '👨‍🍳 *Pedido en Preparación*

Hola {clientName}! Estamos preparando tu pedido.

📦 Pedido: #{orderId}
⏱️ Tiempo estimado: 30-45 min

Te avisaremos cuando salga para entrega.';
    END IF;

    -- IN_TRANSIT
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'template_transit') THEN
        ALTER TABLE whatsapp_config ADD COLUMN template_transit TEXT DEFAULT '🚚 *Pedido en Camino*

Hola {clientName}! Tu pedido está en camino.

📦 Pedido: #{orderId}
{deliveryAddress}

¡Pronto estaremos ahí!';
    END IF;

    -- DELIVERED
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'template_delivered') THEN
        ALTER TABLE whatsapp_config ADD COLUMN template_delivered TEXT DEFAULT '✅ *Pedido Entregado*

Hola {clientName}! Tu pedido ha sido entregado.

📦 Pedido: #{orderId}
💰 Total: ${total}

¡Gracias por tu compra! 🎉';
    END IF;

    -- CANCELLED
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'template_cancelled') THEN
        ALTER TABLE whatsapp_config ADD COLUMN template_cancelled TEXT DEFAULT '❌ *Pedido Cancelado*

Hola {clientName}, lamentamos informarte que tu pedido ha sido cancelado.

📦 Pedido: #{orderId}

Si tenés alguna consulta, no dudes en contactarnos.';
    END IF;

END $$;
-- MIGRACIÓN FINAL: Modificar ENUM de status (si existe) o crear constraint
-- Esta migración maneja ambos casos: ENUM o VARCHAR

DO $$ 
DECLARE
    column_type text;
    enum_name text;
BEGIN
    -- Verificar el tipo de la columna status
    SELECT data_type, udt_name INTO column_type, enum_name
    FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'status';
    
    RAISE NOTICE 'Column type: %, UDT: %', column_type, enum_name;
    
    -- Si es un ENUM, necesitamos agregar los nuevos valores
    IF column_type = 'USER-DEFINED' THEN
        RAISE NOTICE 'Status is an ENUM type, adding new values...';
        
        -- Agregar nuevos valores al ENUM si no existen
        BEGIN
            ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'IN_PREPARATION';
        EXCEPTION WHEN duplicate_object THEN
            RAISE NOTICE 'IN_PREPARATION already exists in enum';
        END;
        
        BEGIN
            ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
        EXCEPTION WHEN duplicate_object THEN
            RAISE NOTICE 'IN_TRANSIT already exists in enum';
        END;
        
    ELSE
        RAISE NOTICE 'Status is VARCHAR/TEXT, managing with CHECK constraint...';
        
        -- Eliminar constraints existentes
        EXECUTE (
            SELECT string_agg('ALTER TABLE orders DROP CONSTRAINT ' || quote_ident(conname) || ';', ' ')
            FROM pg_constraint
            WHERE conrelid = 'orders'::regclass AND conname LIKE '%status%'
        );
        
        -- Crear nuevo constraint
        ALTER TABLE orders 
          ADD CONSTRAINT orders_status_check 
          CHECK (status IN ('PENDING', 'CONFIRMED', 'IN_PREPARATION', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'));
    END IF;
    
    -- Crear índice
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    
    RAISE NOTICE '✅ Migration completed successfully!';
END $$;
-- SIMPLIFIED ORDER STATUS MIGRATION
-- Run this in Supabase SQL Editor

-- Step 1: Drop the constraint (if it exists)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Step 2: Add the new constraint with all 6 statuses
-- Using a simpler approach without ::text cast
ALTER TABLE orders 
  ADD CONSTRAINT orders_status_check 
  CHECK (
    status = 'PENDING' OR 
    status = 'CONFIRMED' OR 
    status = 'IN_PREPARATION' OR 
    status = 'IN_TRANSIT' OR 
    status = 'DELIVERED' OR 
    status = 'CANCELLED'
  );

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Step 4: Verify the constraint was created
-- Run this query to check:
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'orders'::regclass AND conname = 'orders_status_check';
-- MIGRACIÓN DEFINITIVA: Agregar nuevos estados de pedido
-- Esta migración elimina TODOS los constraints de status y crea uno nuevo

-- Paso 1: Eliminar TODOS los constraints que puedan estar bloqueando
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    -- Buscar y eliminar cualquier constraint que contenga 'status' en orders
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'orders'::regclass 
        AND conname LIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE orders DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Paso 2: Agregar el nuevo constraint con los 6 estados
ALTER TABLE orders 
  ADD CONSTRAINT orders_status_check 
  CHECK (
    status IN ('PENDING', 'CONFIRMED', 'IN_PREPARATION', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')
  );

-- Paso 3: Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Paso 4: Verificar que se creó correctamente
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'New status values allowed: PENDING, CONFIRMED, IN_PREPARATION, IN_TRANSIT, DELIVERED, CANCELLED';
END $$;
-- Add new order statuses: IN_PREPARATION and IN_TRANSIT
-- This allows tracking the full order lifecycle

-- First, drop the existing constraint if it exists
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the new constraint with all statuses
-- Note: PostgreSQL text comparison is case-sensitive, so we use exact values
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status::text IN ('PENDING', 'CONFIRMED', 'IN_PREPARATION', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'));

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
-- Add is_active column to products for Soft Delete pattern
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Ensure index exists for performance
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Create claims table
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id),
    type VARCHAR(50) DEFAULT 'general', -- 'complaint', 'suggestion', 'issue'
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'in_progress', 'resolved'
    description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_claims_client_id ON claims(client_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

-- RLS (Optional for now, but good practice)
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read/write for authenticated users only" ON claims
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Public access (if needed for public facing pages, but admin panel is auth)
-- For now, allow public verify via API functions if needed.
-- Migration: 20260218_delivery_slots
-- Description: Create delivery_slots table and add relation to orders

-- 1. Create delivery_slots table
CREATE TABLE IF NOT EXISTS delivery_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    time_start TIME NOT NULL,
    time_end TIME NOT NULL,
    max_orders INTEGER DEFAULT 5,
    orders_count INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    cut_off_minutes INTEGER DEFAULT 30,
    version INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, time_start)
);

-- 2. Add delivery_slot_id to orders
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_slot_id') THEN
        ALTER TABLE orders ADD COLUMN delivery_slot_id UUID REFERENCES delivery_slots(id);
    END IF;
END $$;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_slots_date_time ON delivery_slots(date, time_start);
-- Migration: 20260218_logistics_system
-- Description: Adds tables and columns for the Route Optimization and Logistics System.
-- Author: Antigravity

-- 1. ENUMS (Idempotent)
DO $$ BEGIN
    CREATE TYPE route_order_status AS ENUM ('PENDING', 'IN_PROGRESS', 'DELIVERED', 'FAILED', 'SKIPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE route_optimization_type AS ENUM ('AUTO', 'MANUAL', 'UNDO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('ON_ROUTE', 'ARRIVING', 'DELIVERED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. ROUTES TABLE UPDATES (Idempotent)
-- Add columns to 'routes' if they don't exist
DO $$ 
BEGIN
    -- start_address
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='start_address') THEN
        ALTER TABLE routes ADD COLUMN start_address TEXT;
    END IF;
    -- start_lat
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='start_lat') THEN
        ALTER TABLE routes ADD COLUMN start_lat DECIMAL(10, 8);
    END IF;
    -- start_lng
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='start_lng') THEN
        ALTER TABLE routes ADD COLUMN start_lng DECIMAL(11, 8);
    END IF;
    -- total_distance_km
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='total_distance_km') THEN
        ALTER TABLE routes ADD COLUMN total_distance_km DECIMAL(8, 2);
    END IF;
    -- estimated_duration_min
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='estimated_duration_min') THEN
        ALTER TABLE routes ADD COLUMN estimated_duration_min INTEGER;
    END IF;
    -- optimized_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='optimized_at') THEN
        ALTER TABLE routes ADD COLUMN optimized_at TIMESTAMP WITH TIME ZONE;
    END IF;
    -- optimization_version
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='optimization_version') THEN
        ALTER TABLE routes ADD COLUMN optimization_version INTEGER DEFAULT 0;
    END IF;
    -- notifications_sent
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='notifications_sent') THEN
        ALTER TABLE routes ADD COLUMN notifications_sent BOOLEAN DEFAULT FALSE;
    END IF;
    -- updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='updated_at') THEN
        ALTER TABLE routes ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 3. ROUTE_ORDERS TABLE UPDATES (Idempotent)
-- We need to check if table exists first (it does in schema.sql but might be empty/simple)
-- If it exists, we add columns. If not, we create it.
CREATE TABLE IF NOT EXISTS route_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE RESTRICT NOT NULL,
    sequence_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(route_id, order_id)
);

DO $$ 
BEGIN
    -- previous_sequence
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='previous_sequence') THEN
        ALTER TABLE route_orders ADD COLUMN previous_sequence INTEGER;
    END IF;
    -- delivery_lat
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='delivery_lat') THEN
        ALTER TABLE route_orders ADD COLUMN delivery_lat DECIMAL(10, 8);
    END IF;
    -- delivery_lng
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='delivery_lng') THEN
        ALTER TABLE route_orders ADD COLUMN delivery_lng DECIMAL(11, 8);
    END IF;
    -- formatted_address
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='formatted_address') THEN
        ALTER TABLE route_orders ADD COLUMN formatted_address TEXT;
    END IF;
    -- estimated_arrival
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='estimated_arrival') THEN
        -- It might exist as TIME, we want to ensure it is compatible or just leave it
        -- Schema says TIME, plan says TIME. Good.
        NULL; 
    END IF;
    -- estimated_travel_time_min
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='estimated_travel_time_min') THEN
        ALTER TABLE route_orders ADD COLUMN estimated_travel_time_min INTEGER;
    END IF;
    -- actual_arrival
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='actual_arrival') THEN
        ALTER TABLE route_orders ADD COLUMN actual_arrival TIMESTAMP WITH TIME ZONE;
    END IF;
    -- actual_departure
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='actual_departure') THEN
        ALTER TABLE route_orders ADD COLUMN actual_departure TIMESTAMP WITH TIME ZONE;
    END IF;
    -- status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='status') THEN
        ALTER TABLE route_orders ADD COLUMN status route_order_status DEFAULT 'PENDING';
    END IF;
    -- delivery_photo_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='delivery_photo_url') THEN
        ALTER TABLE route_orders ADD COLUMN delivery_photo_url TEXT;
    END IF;
    -- recipient_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='recipient_name') THEN
        ALTER TABLE route_orders ADD COLUMN recipient_name VARCHAR(255);
    END IF;
    -- signature_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='signature_url') THEN
        ALTER TABLE route_orders ADD COLUMN signature_url TEXT;
    END IF;
    -- notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='notes') THEN
        ALTER TABLE route_orders ADD COLUMN notes TEXT;
    END IF;
    -- failure_reason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='failure_reason') THEN
        ALTER TABLE route_orders ADD COLUMN failure_reason VARCHAR(50);
    END IF;
    -- notification_sent
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='notification_sent') THEN
        ALTER TABLE route_orders ADD COLUMN notification_sent BOOLEAN DEFAULT FALSE;
    END IF;
    -- updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_orders' AND column_name='updated_at') THEN
        ALTER TABLE route_orders ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    -- Constraint: UNIQUE(route_id, sequence_number) DEFERRABLE used for swapping?
    -- For now standard unique, can drop if problematic for simple swapping
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'route_orders_route_id_sequence_number_key') THEN
        ALTER TABLE route_orders ADD CONSTRAINT route_orders_route_id_sequence_number_key UNIQUE(route_id, sequence_number);
    END IF;
END $$;

-- 4. NEW TABLES
CREATE TABLE IF NOT EXISTS route_optimization_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
    optimization_type route_optimization_type NOT NULL,
    previous_sequence JSONB,
    new_sequence JSONB,
    total_distance_before DECIMAL(8, 2),
    total_distance_after DECIMAL(8, 2),
    calculated_by VARCHAR(50) DEFAULT 'algorithm',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    route_order_id UUID REFERENCES route_orders(id) ON DELETE CASCADE,
    notification_type notification_type NOT NULL,
    whatsapp_message_id VARCHAR(100),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    failed_reason TEXT,
    template_used VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_routes_status_date ON routes(status, date);
CREATE INDEX IF NOT EXISTS idx_routes_driver ON routes(driver_name, date);
CREATE INDEX IF NOT EXISTS idx_route_orders_route_sequence ON route_orders(route_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_route_orders_order ON route_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_route_orders_status ON route_orders(status);
-- Migration: 20260219_fix_client_deletion.sql
-- Description: Allow deleting clients by changing strict FK constraints to SET NULL or CASCADE.

-- 1. ORDERS: Keep orders but unlink from client (financial history)
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_client_id_fkey;

ALTER TABLE orders
ADD CONSTRAINT orders_client_id_fkey
FOREIGN KEY (client_id)
REFERENCES clients(id)
ON DELETE SET NULL;

-- 2. WHATSAPP CONVERSATIONS: Delete chats if client is deleted (or unlink?)
-- Usually if I delete a client I expect their chat to go or just unlink.
-- Current schema says SET NULL. If it was blocking, it might be another constraint.
-- Let's ensure it is SET NULL or CASCADE.
ALTER TABLE whatsapp_conversations
DROP CONSTRAINT IF EXISTS whatsapp_conversations_client_id_fkey;

ALTER TABLE whatsapp_conversations
ADD CONSTRAINT whatsapp_conversations_client_id_fkey
FOREIGN KEY (client_id)
REFERENCES clients(id)
ON DELETE SET NULL;

-- 3. CLAIMS: Keep claims but unlink
-- Check if claims table exists first (it was added in a recent migration)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claims') THEN
        ALTER TABLE claims
        DROP CONSTRAINT IF EXISTS claims_client_id_fkey;

        ALTER TABLE claims
        ADD CONSTRAINT claims_client_id_fkey
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 4. MOVEMENTS: Already CASCADE in schema, but ensuring it.
ALTER TABLE movements
DROP CONSTRAINT IF EXISTS movements_client_id_fkey;

ALTER TABLE movements
ADD CONSTRAINT movements_client_id_fkey
FOREIGN KEY (client_id)
REFERENCES clients(id)
ON DELETE CASCADE;
-- Migration to add checkout_message to whatsapp_config
ALTER TABLE public.whatsapp_config
ADD COLUMN IF NOT EXISTS checkout_message TEXT DEFAULT 'El pedido ya fue enviado a cocina.';
create table if not exists dashboard_config (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id) on delete cascade,
  widgets jsonb not null default '{"stats": true, "whatsapp": true, "routes": true, "system": true, "chart": true, "activity": true}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id) -- One config per user
);

-- Insert a default global config if no user-specific is needed right now or for general purpose
insert into dashboard_config (widgets) 
values ('{"stats": true, "whatsapp": true, "routes": true, "system": true, "chart": true, "activity": true}')
on conflict do nothing;
-- Add conversation status for Bot vs Handover
ALTER TABLE "public"."whatsapp_conversations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT 'BOT';

-- Comment: Status can be 'BOT' or 'HANDOVER'
-- Add Sileo configuration column to whatsapp_config
ALTER TABLE "public"."whatsapp_config" ADD COLUMN IF NOT EXISTS "sileo_api_key" VARCHAR(255);
-- ============================================================
-- ENTERPRISE BARCODE SYSTEM MIGRATION
-- ============================================================

-- 1. Extend products table with barcode fields
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS barcode VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS barcode_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS barcode_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS barcode_scanned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS barcode_scan_count INTEGER DEFAULT 0;

-- 2. Create audit table for scans
CREATE TABLE IF NOT EXISTS barcode_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    barcode VARCHAR(50) NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    scan_type VARCHAR(20) CHECK (scan_type IN ('inventory', 'sale', 'lookup')),
    status VARCHAR(20) CHECK (status IN ('success', 'not_found', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Optimization indexes
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_scans_barcode ON barcode_scans(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_scans_created_at ON barcode_scans(created_at DESC);
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"isActive": false, "days": [1,2,3,4,5], "startTime": "09:00", "endTime": "18:00", "timezone": "America/Argentina/Buenos_Aires"}'::jsonb;
-- Agrega las columnas de configuración del catálogo a whatsapp_config si no existen
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_banner_url TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_logo_url TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_business_name TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_accent_color TEXT DEFAULT '#dc2626';
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
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
-- 1. Agregar columnas necesarias a products y whatsapp_config
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url_1 TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url_2 TEXT;

ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_banner_url TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_logo_url TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_business_name TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS catalog_accent_color TEXT DEFAULT '#dc2626';
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

-- 2. Activar Seguridad a Nivel de Fila (RLS) en las tablas originales
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

-- 3. Limpiar políticas previas por si reejecutamos
DROP POLICY IF EXISTS "Admin full access products" ON products;
DROP POLICY IF EXISTS "Admin full access whatsapp_config" ON whatsapp_config;

-- 4. Crear políticas para el administrador (login) para que pueda seguir usando el panel
CREATE POLICY "Admin full access products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access whatsapp_config" ON whatsapp_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Crear Vista de Catálogo (solo expone columnas seguras y el flag in_stock)
DROP VIEW IF EXISTS public_catalog;
CREATE VIEW public_catalog AS
SELECT id, name, description, price, category, image_url_1, image_url_2, (stock > 0) as in_stock
FROM products
WHERE is_active = true;

-- 6. Crear Vista de Branding (solo expone nombre, logo, colores y número WA)
DROP VIEW IF EXISTS public_branding;
CREATE VIEW public_branding AS
SELECT catalog_banner_url, catalog_logo_url, catalog_business_name, catalog_accent_color, whatsapp_phone
FROM whatsapp_config
ORDER BY id DESC LIMIT 1;

-- 7. Dar permisos de lectura al público (anon) SOLO para las Vistas (no para las tablas)
GRANT SELECT ON public_catalog TO anon;
GRANT SELECT ON public_branding TO anon;
-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public read access to the bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );

-- 3. Allow authenticated users to insert files
CREATE POLICY "Admin Insert Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'product-images' );

-- 4. Allow authenticated users to update files (overwrite)
CREATE POLICY "Admin Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'product-images' );

-- 5. Allow authenticated users to delete files
CREATE POLICY "Admin Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'product-images' );
-- Add image columns to products table (2 images max per product)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url_1 TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url_2 TEXT;
-- ============================================
-- MIGRACIÓN: STOCK AUTO-REFILL DIARIO
-- Permite a los productos tener un stock
-- que se repone automáticamente cada día
-- a las 06:00 AM (hora operativa).
-- ============================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS auto_refill BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_refill_qty INTEGER NOT NULL DEFAULT 0;

-- Comentarios descriptivos
COMMENT ON COLUMN products.auto_refill IS 'Si es true, el stock se restaura automáticamente a las 06:00 AM cada día.';
COMMENT ON COLUMN products.auto_refill_qty IS 'Cantidad a la que se restaura el stock si auto_refill = true.';
-- Migration: Stock Flow Update
-- Add production_stock and min_stock to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS production_stock integer not null default 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock integer not null default 0;

-- CreateEnum for stock movement types
DO $$ BEGIN
    CREATE TYPE stock_movement_type AS ENUM ('PURCHASE', 'TRANSFER', 'SALE', 'ADJUSTMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references products(id) on delete cascade not null,
  type stock_movement_type not null,
  quantity integer not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast queries on product movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
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
-- ===========================================
-- MIGRATION: Separar Inventario de Catálogo de Ventas
-- Date: 2026-03-04
-- Description: Creates catalog_items table for finished/elaborated products
--              sold to customers (e.g., pizza, grilled chicken).
--              The `products` table remains for raw material stock management.
-- ===========================================

-- 1. Create the catalog_items table for sellable/elaborated products
CREATE TABLE IF NOT EXISTS catalog_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text,
  price decimal(10, 2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  category text DEFAULT 'General',
  image_url_1 text,
  image_url_2 text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items(category);
CREATE INDEX IF NOT EXISTS idx_catalog_items_is_active ON catalog_items(is_active);

-- 3. Replace the public_catalog view to use catalog_items instead of products
-- This is the view used by the public-facing Catalog page (/catalog)
CREATE OR REPLACE VIEW public_catalog AS
  SELECT
    id,
    name,
    description,
    price,
    category,
    image_url_1,
    image_url_2,
    (stock > 0 AND is_active = true) AS in_stock
  FROM catalog_items
  WHERE is_active = true
  ORDER BY category, name;

-- 4. Add a column to order_items to reference catalog_items instead of products
-- NOTE: We add as nullable at first to allow gradual migration, then make required.
ALTER TABLE order_items 
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE RESTRICT;

-- 5. Enable Realtime for catalog_items so admin panel updates in real time
ALTER PUBLICATION supabase_realtime ADD TABLE catalog_items;
-- ===========================================
-- MIGRATION: Campos de Insumos para Inventario
-- Date: 2026-03-04
-- Description: Agrega campos orientados a la cadena de suministro
--              (costo, proveedor, fecha ingreso) a la tabla products
--              ya que ahora es exclusiva para materia prima.
-- ===========================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS last_restock_date date;

-- Las columnas image_url_1 y image_url_2 quedan obsoletas para el inventario,
-- pero las dejamos para evitar romper historiales. Simplemente el frontend
-- dejará de usarlas/pedirlas.
-- ===========================================
-- MIGRATION: Columnas faltantes de producción y alertas
-- Date: 2026-03-04
-- ===========================================

-- Agregamos las columnas que el formulario de inventario ya
-- estaba enviando pero que no existían en la tabla real.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS min_stock numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_stock numeric DEFAULT 0;

-- Forzamos a que Supabase recargue su caché de columnas para que tome los cambios de inmediato
NOTIFY pgrst, 'reload schema';
-- ===========================================
-- MIGRATION: Recetas y Capacidad de Producción
-- Date: 2026-03-04
-- Description: Links catalog_items to raw product ingredients.
--              Calculates how many units can be produced from current stock.
-- ===========================================

-- 1. Recipes table (one per catalog_item)
CREATE TABLE IF NOT EXISTS recipes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE CASCADE NOT NULL UNIQUE,
  notes text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Recipe ingredients (insumos needed per recipe)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'un', -- 'un', 'g', 'kg', 'ml', 'l'
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(recipe_id, product_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_recipes_catalog_item ON recipes(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_product ON recipe_ingredients(product_id);

-- 4. View: Production Capacity
-- For each catalog_item with a recipe, calculates the minimum producible
-- quantity across all ingredients based on current warehouse stock (products.stock).
CREATE OR REPLACE VIEW production_capacity AS
SELECT
  ci.id              AS catalog_item_id,
  ci.name            AS catalog_item_name,
  ci.category        AS category,
  ci.price           AS price,
  ci.image_url_1     AS image_url_1,
  r.id               AS recipe_id,
  r.notes            AS recipe_notes,
  -- The bottleneck: the ingredient with the least producible quantity
  MIN(FLOOR(
    CASE
      WHEN ri.unit IN ('kg') THEN (p.stock * 1000) / ri.quantity  -- convert kg→g if needed
      ELSE p.stock / ri.quantity
    END
  ))::integer        AS max_producible,
  -- The limiting ingredient name (for display)
  (
    SELECT p2.name
    FROM recipe_ingredients ri2
    JOIN products p2 ON p2.id = ri2.product_id
    WHERE ri2.recipe_id = r.id
    ORDER BY FLOOR(p2.stock / ri2.quantity) ASC
    LIMIT 1
  )                  AS bottleneck_ingredient
FROM catalog_items ci
JOIN recipes r ON r.catalog_item_id = ci.id
JOIN recipe_ingredients ri ON ri.recipe_id = r.id
JOIN products p ON p.id = ri.product_id
WHERE ci.is_active = true
GROUP BY ci.id, ci.name, ci.category, ci.price, ci.image_url_1, r.id, r.notes;
-- Enforce Realtime on orders
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;
COMMIT;
-- ===========================================
-- MIGRATION: Desglose de Comandas por Estaciones
-- Date: 2026-03-05
-- Description: Creates recipe_components (sub-items per station)
--              and order_station_tasks (per-station tickets from orders).
--              Includes trigger to auto-generate tasks on new orders
--              and to auto-complete orders when all tasks are done.
-- ===========================================

-- 1. Recipe Components (Componentes de producción por estación)
-- Ej: catalog_item "Combo Asado" -> component "Asado de tira" (Parrilla), "Guarnición Fritas" (Cocina Caliente)
CREATE TABLE IF NOT EXISTS recipe_components (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,                       -- "Asado de tira", "Porción de Fritas"
  station_id uuid REFERENCES stations(id) ON DELETE SET NULL,
  sort_order integer DEFAULT 0,             -- Para ordenar los componentes visualmente
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipe_components_catalog ON recipe_components(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_components_station ON recipe_components(station_id);

-- 2. Order Station Tasks (Tickets por estación generados de cada pedido)
CREATE TABLE IF NOT EXISTS order_station_tasks (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  station_id uuid REFERENCES stations(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' NOT NULL,   -- 'pending', 'preparing', 'ready'
  items jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{name: "Asado de tira", quantity: 2}, ...]
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ost_order ON order_station_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_ost_station ON order_station_tasks(station_id);
CREATE INDEX IF NOT EXISTS idx_ost_status ON order_station_tasks(status);

-- Enable Realtime for order_station_tasks so station tablets update live
ALTER PUBLICATION supabase_realtime ADD TABLE order_station_tasks;

-- Enable RLS (permissive for now)
ALTER TABLE recipe_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_station_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for all" ON recipe_components FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for all" ON order_station_tasks FOR ALL USING (true) WITH CHECK (true);

-- 3. FUNCTION: Generate station tasks when an order is inserted or updated to 'confirmed'
-- This reads the order's items JSON, looks up recipe_components for each item,
-- and creates one order_station_task per station with the relevant items grouped.
CREATE OR REPLACE FUNCTION generate_order_station_tasks()
RETURNS TRIGGER AS $$
DECLARE
  item jsonb;
  comp record;
  task_map jsonb := '{}';  -- station_id -> [items]
  station_key text;
  existing_tasks integer;
BEGIN
  -- Only generate tasks when the order transitions to 'CONFIRMED'
  IF NEW.status != 'CONFIRMED' THEN
    RETURN NEW;
  END IF;
  
  -- Don't regenerate if tasks already exist for this order
  SELECT COUNT(*) INTO existing_tasks FROM order_station_tasks WHERE order_id = NEW.id;
  IF existing_tasks > 0 THEN
    RETURN NEW;
  END IF;

  -- Iterate over each item in the order
  FOR item IN 
    SELECT oi.quantity as qty, COALESCE(ci.name, p.name) as name, ci.station_id as catalog_station_id, oi.catalog_item_id
    FROM order_items oi
    LEFT JOIN catalog_items ci ON ci.id = oi.catalog_item_id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
  LOOP
    DECLARE
      item_name text := item.name;
      item_qty integer := item.qty;
      has_components boolean := false;
      fallback_station_id uuid;
    BEGIN
      -- Check if this catalog item has recipe_components
      FOR comp IN 
        SELECT rc.name as comp_name, rc.station_id as comp_station_id
        FROM recipe_components rc
        WHERE rc.catalog_item_id = item.catalog_item_id
        ORDER BY rc.sort_order
      LOOP
        has_components := true;
        station_key := comp.comp_station_id::text;
        
        -- Add to task_map for this station
        IF task_map ? station_key THEN
          task_map := jsonb_set(
            task_map, 
            ARRAY[station_key], 
            (task_map->station_key) || jsonb_build_object('name', comp.comp_name, 'quantity', item_qty, 'parent_item', item_name)
          );
        ELSE
          task_map := jsonb_set(
            task_map, 
            ARRAY[station_key], 
            jsonb_build_array(jsonb_build_object('name', comp.comp_name, 'quantity', item_qty, 'parent_item', item_name))
          );
        END IF;
      END LOOP;

      -- Fallback: if no components defined, use the catalog_item's own station_id
      IF NOT has_components THEN
        -- We already fetched the fallback station ID in the main query!
        fallback_station_id := item.catalog_station_id;

        IF fallback_station_id IS NOT NULL THEN
          station_key := fallback_station_id::text;
          IF task_map ? station_key THEN
            task_map := jsonb_set(
              task_map, 
              ARRAY[station_key], 
              (task_map->station_key) || jsonb_build_object('name', item_name, 'quantity', item_qty)
            );
          ELSE
            task_map := jsonb_set(
              task_map, 
              ARRAY[station_key], 
              jsonb_build_array(jsonb_build_object('name', item_name, 'quantity', item_qty))
            );
          END IF;
        END IF;
      END IF;
    END;
  END LOOP;

  -- Insert one order_station_task per station
  FOR station_key IN SELECT * FROM jsonb_object_keys(task_map)
  LOOP
    INSERT INTO order_station_tasks (order_id, station_id, items, status)
    VALUES (NEW.id, station_key::uuid, task_map->station_key, 'pending');
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_station_tasks ON orders;
CREATE TRIGGER trg_generate_station_tasks
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION generate_order_station_tasks();

-- 4. FUNCTION: Auto-complete order when ALL station tasks are 'ready'
CREATE OR REPLACE FUNCTION check_order_completion()
RETURNS TRIGGER AS $$
DECLARE
  total_tasks integer;
  ready_tasks integer;
BEGIN
  IF NEW.status = 'ready' THEN
    -- Update completed_at timestamp
    NEW.completed_at := now();
    
    -- Count total vs ready tasks for this order, EXCLUDING the current one
    -- (since this is a BEFORE trigger, the current row in the DB still has the old status)
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'ready')
    INTO total_tasks, ready_tasks
    FROM order_station_tasks
    WHERE order_id = NEW.order_id AND id != NEW.id;

    -- If all OTHER tasks are ready, then with this one becoming ready, ALL are ready
    IF total_tasks = ready_tasks THEN
      UPDATE orders SET status = 'DELIVERED' WHERE id = NEW.order_id;
    END IF;
  END IF;

  -- If moving to 'preparing', set started_at
  IF NEW.status = 'preparing' AND OLD.status = 'pending' THEN
    NEW.started_at := now();
    -- Also move the parent order to 'IN_PREPARATION' if it's still pending/confirmed
    UPDATE orders SET status = 'IN_PREPARATION' 
    WHERE id = NEW.order_id AND status IN ('PENDING', 'CONFIRMED');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_order_completion ON order_station_tasks;
CREATE TRIGGER trg_check_order_completion
BEFORE UPDATE ON order_station_tasks
FOR EACH ROW EXECUTE FUNCTION check_order_completion();
-- ===========================================
-- MIGRATION: Turnos de Trabajo y Estaciones de Cocina
-- Date: 2026-03-05
-- Description: Crea tablas employees, stations, shifts
--              y relaciona stock_movements con el empleado/turno.
-- ===========================================

-- 1. Empleados
CREATE TABLE IF NOT EXISTS employees (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  role text DEFAULT 'cocinero',       -- cocinero, parrillero, encargado, etc.
  pin_code text,                       -- PIN numérico (4 dígitos) para login rápido
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Estaciones de Trabajo
CREATE TABLE IF NOT EXISTS stations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,                  -- "Parrilla", "Cocina Caliente", "Mesa Fría"
  color text DEFAULT '#3b82f6',        -- Color para UI (badge, borde)
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. Turnos
CREATE TABLE IF NOT EXISTS shifts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id uuid REFERENCES employees(id) ON DELETE RESTRICT NOT NULL,
  station_id uuid REFERENCES stations(id) ON DELETE RESTRICT NOT NULL,
  start_time timestamptz DEFAULT now() NOT NULL,
  end_time timestamptz,
  status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 4. Relacionar stock_movements con turnos y empleados
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES employees(id) ON DELETE SET NULL;

-- 5. Agregar estación a catalog_items para rutear las comandas
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES stations(id) ON DELETE SET NULL;

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_shifts_station ON shifts(station_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_shift ON stock_movements(shift_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_employee ON stock_movements(employee_id);

-- Habilitar Realtime para shifts (para detectar turnos nuevos en cocina)
ALTER PUBLICATION supabase_realtime ADD TABLE shifts;

-- Seed data: estaciones por defecto
INSERT INTO stations (name, color) VALUES
  ('Parrilla', '#ef4444'),
  ('Cocina Caliente', '#f97316'),
  ('Mesa Fría', '#3b82f6')
ON CONFLICT DO NOTHING;

-- Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';
-- ===========================================
-- MIGRATION: Row Level Security (RLS) Policies
-- Date: 2026-03-06
-- Description: Enables RLS on critical tables and creates access policies.
--              The WhatsApp bot uses SERVICE_ROLE_KEY which bypasses RLS.
--              The admin panel uses authenticated users (via Supabase Auth).
--              The public catalog is read-only for anonymous users.
-- ===========================================

-- ═══════════════════════════════════════
-- 1. CATALOG ITEMS (Public read, admin write)
-- ═══════════════════════════════════════
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

-- Public: anyone can read active catalog items
CREATE POLICY "catalog_items_public_read" ON catalog_items
  FOR SELECT USING (is_active = true);

-- Admin: authenticated users can do everything
CREATE POLICY "catalog_items_admin_all" ON catalog_items
  FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════
-- 2. ORDERS (Admin only, bot uses service key)
-- ═══════════════════════════════════════
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_admin_all" ON orders
  FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════
-- 3. ORDER ITEMS (Admin only)
-- ═══════════════════════════════════════
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_admin_all" ON order_items
  FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════
-- 4. STATIONS (Admin read/write, public read for tablet displays)
-- ═══════════════════════════════════════
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stations_public_read" ON stations
  FOR SELECT USING (is_active = true);

CREATE POLICY "stations_admin_all" ON stations
  FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════
-- 5. ORDER STATION TASKS (Admin + public read for kitchen tablets)
-- ═══════════════════════════════════════
ALTER TABLE order_station_tasks ENABLE ROW LEVEL SECURITY;

-- Kitchen tablets can read and update their tasks
CREATE POLICY "station_tasks_public_read" ON order_station_tasks
  FOR SELECT USING (true);

CREATE POLICY "station_tasks_public_update" ON order_station_tasks
  FOR UPDATE USING (true);

CREATE POLICY "station_tasks_admin_all" ON order_station_tasks
  FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════
-- 6. RECIPE COMPONENTS (Admin only)
-- ═══════════════════════════════════════
ALTER TABLE recipe_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipe_components_admin_all" ON recipe_components
  FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════
-- 7. CLIENTS (Admin only, bot uses service key)
-- ═══════════════════════════════════════
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_admin_all" ON clients
  FOR ALL USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════
-- 8. PRODUCTS / RAW MATERIALS (Admin only)
-- ═══════════════════════════════════════
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_admin_all" ON products
  FOR ALL USING (auth.role() = 'authenticated');
-- ===========================================
-- MIGRATION: Sanitize Schema for Production
-- Date: 2026-03-06
-- Description: Makes product_id nullable on order_items to support
--              the transition to catalog_item_id as the primary reference.
-- ===========================================

-- 1. Drop NOT NULL constraint on product_id
-- This allows orders to be created using only catalog_item_id
ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;

-- 2. Make catalog_item_id NOT NULL for new data integrity
-- (Only enable this AFTER all existing rows have been backfilled)
-- ALTER TABLE order_items ALTER COLUMN catalog_item_id SET NOT NULL;

-- 3. Add index on catalog_item_id for query performance (trigger joins on this)
CREATE INDEX IF NOT EXISTS idx_order_items_catalog_item_id ON order_items(catalog_item_id);
-- ===========================================
-- MIGRATION: Módulo de Logística Inteligente y Verificación (LIV)
-- Date: 2026-03-06
-- ===========================================

-- 1. Agregar configuración de origen (Local) a whatsapp_config
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'store_lat') THEN
        ALTER TABLE whatsapp_config ADD COLUMN store_lat DECIMAL(10, 8);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'store_lng') THEN
        ALTER TABLE whatsapp_config ADD COLUMN store_lng DECIMAL(11, 8);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_config' AND column_name = 'shipping_policy') THEN
        -- flex (Texto), smart (Híbrido), secure (GPS Obligatorio)
        ALTER TABLE whatsapp_config ADD COLUMN shipping_policy VARCHAR(20) DEFAULT 'smart';
    END IF;
END $$;


-- 2. Asegurarse de que la tabla orders soporte lat y lng del delivery
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_lat') THEN
        ALTER TABLE orders ADD COLUMN delivery_lat DECIMAL(10, 8);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_lng') THEN
        ALTER TABLE orders ADD COLUMN delivery_lng DECIMAL(11, 8);
    END IF;
END $$;


-- 3. Crear/Reestructurar la tabla shipping_zones
-- Primero comprobamos si existe. Si existe pero no tiene el esquema correcto, la tiramos y recreamos.
DROP TABLE IF EXISTS shipping_zones CASCADE;

CREATE TABLE shipping_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    zone_type VARCHAR(20) NOT NULL DEFAULT 'radius', -- 'radius' o 'text_match'
    max_radius_km DECIMAL(10, 2), -- Usado si zone_type = 'radius'
    match_keywords TEXT, -- Usado si zone_type = 'text_match' (separadas por comas)
    cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;

-- Políticas (Lectura pública para el catálogo/bot, Escritura solo para admins)
CREATE POLICY "Enable read access for all users" ON shipping_zones FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON shipping_zones FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON shipping_zones FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users only" ON shipping_zones FOR DELETE USING (true);


-- 4. Recrear la vista de branding público (opcional pero ayuda al catálogo a no exponer el token)
DROP VIEW IF EXISTS public_branding;
CREATE VIEW public_branding AS 
SELECT 
    welcome_message, 
    whatsapp_phone, 
    catalog_banner_url, 
    catalog_logo_url, 
    catalog_business_name, 
    catalog_accent_color,
    store_lat,
    store_lng
FROM whatsapp_config 
WHERE is_active = true 
LIMIT 1;
-- ===========================================
-- MIGRATION: Add phone to employees
-- Date: 2026-03-08
-- Description: Adds phone column to support logistics notifications
-- ===========================================

ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS phone text;

-- Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';
-- ===========================================
-- MIGRATION: Logística 2.0 (Misiones y Seguimiento)
-- Date: 2026-03-08
-- Description: Implementa el nuevo modelo de misiones dinámicas
-- ===========================================

BEGIN;

-- 1. Actualizar estados de pedidos
DO $$ 
BEGIN
    -- Añadir OUT_FOR_DELIVERY si es ENUM
    BEGIN
        ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PICKED_UP';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    -- Si es por CHECK constraint (fallback)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check') THEN
        ALTER TABLE orders DROP CONSTRAINT orders_status_check;
        ALTER TABLE orders ADD CONSTRAINT orders_status_check 
        CHECK (status IN ('PENDING', 'CONFIRMED', 'IN_PREPARATION', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP', 'DELIVERED', 'CANCELLED'));
    END IF;
END $$;

-- 2. Tabla de Metadatos de Cadetes (Extiende Employees)
CREATE TABLE IF NOT EXISTS cadete_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
    vehicle_type TEXT DEFAULT 'moto', -- moto, auto, bici
    max_capacity INTEGER DEFAULT 10,
    status TEXT DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BUSY', 'OFFLINE', 'BREAK')),
    rating DECIMAL(3,2) DEFAULT 5.0,
    total_deliveries INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(employee_id)
);

-- 3. Tabla de Ubicaciones en Tiempo Real
CREATE TABLE IF NOT EXISTS cadete_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5, 2),
    heading INTEGER,
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Tabla de Misiones (Assignments)
CREATE TYPE assignment_status AS ENUM ('PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE assignment_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cadete_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    status assignment_status DEFAULT 'PENDING' NOT NULL,
    priority assignment_priority DEFAULT 'NORMAL' NOT NULL,
    estimated_duration_min INTEGER,
    total_distance_km DECIMAL(8, 2),
    batch_group_id UUID, -- Para agrupar misiones relacionadas
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Tabla de Paradas de la Misión (Assignment Orders)
CREATE TYPE assignment_action AS ENUM ('PICKUP', 'DELIVERY');
CREATE TYPE assignment_order_status AS ENUM ('PENDING', 'ARRIVED', 'COMPLETED', 'FAILED');

CREATE TABLE IF NOT EXISTS assignment_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    sequence_number INTEGER NOT NULL,
    action_type assignment_action DEFAULT 'DELIVERY' NOT NULL,
    status assignment_order_status DEFAULT 'PENDING' NOT NULL,
    proof_photo_url TEXT,
    signature_url TEXT,
    notes TEXT,
    estimated_arrival TIMESTAMPTZ,
    actual_arrival TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(assignment_id, order_id, action_type)
);

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_cadete_locations_employee ON cadete_locations(employee_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_cadete ON assignments(cadete_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignment_orders_assignment ON assignment_orders(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_orders_order ON assignment_orders(order_id);

-- 7. Realtime para habilitar el seguimiento en vivo
ALTER PUBLICATION supabase_realtime ADD TABLE cadete_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE assignment_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE cadete_metadata;

-- Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;

-- 1. ASEGURAR PERMISOS (RLS) PARA QUE EL PANEL VEA LOS FLUJOS
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flows_public_read" ON flows;
CREATE POLICY "flows_public_read" ON flows FOR SELECT USING (true);
DROP POLICY IF EXISTS "flows_admin_all" ON flows;
CREATE POLICY "flows_admin_all" ON flows FOR ALL USING (true) WITH CHECK (true);

-- 2. INSERTAR LOS FLUJOS (Corregido con JSONB real para posición y datos)
DELETE FROM flows WHERE name IN ('Bienvenida Pollo Comilón', 'Consulta de Pedido (Bot)', 'Atención Humana (Bot)');

DO $$
DECLARE
    welcome_id UUID := gen_random_uuid();
    consult_id UUID := gen_random_uuid();
    human_id UUID := gen_random_uuid();
BEGIN
    -- FLUJO ATENCIÓN HUMANA
    INSERT INTO flows (id, name, trigger_word, is_active, nodes, edges)
    VALUES (human_id, 'Atención Humana (Bot)', 'humano', true,
        jsonb_build_array(
            jsonb_build_object('id', 'start', 'type', 'input', 'position', jsonb_build_object('x', 250, 'y', 0), 'data', jsonb_build_object('label', 'Inicio')),
            jsonb_build_object('id', 'node_1', 'type', 'handoverNode', 'position', jsonb_build_object('x', 250, 'y', 150), 'data', jsonb_build_object('message', '🍗 *El Pollo Comilón:* Te estamos transfiriendo con un asesor humano. Por favor, aguarda un momento.'))
        ),
        jsonb_build_array(
            jsonb_build_object('id', 'edge_1', 'source', 'start', 'target', 'node_1', 'animated', true)
        )
    );

    -- FLUJO CONSULTA DE PEDIDO
    INSERT INTO flows (id, name, trigger_word, is_active, nodes, edges)
    VALUES (consult_id, 'Consulta de Pedido (Bot)', 'consultar', true,
        jsonb_build_array(
            jsonb_build_object('id', 'start', 'type', 'input', 'position', jsonb_build_object('x', 250, 'y', 0), 'data', jsonb_build_object('label', 'Inicio')),
            jsonb_build_object('id', 'node_1', 'type', 'questionNode', 'position', jsonb_build_object('x', 250, 'y', 150), 'data', jsonb_build_object('question', '🍗 *El Pollo Comilón:* Por favor, ingresá tu número de orden (solo los números):', 'variable', 'order_number')),
            jsonb_build_object('id', 'node_2', 'type', 'orderStatusNode', 'position', jsonb_build_object('x', 250, 'y', 350), 'data', jsonb_build_object('variable', 'order_number'))
        ),
        jsonb_build_array(
            jsonb_build_object('id', 'edge_1', 'source', 'start', 'target', 'node_1', 'animated', true),
            jsonb_build_object('id', 'edge_2', 'source', 'node_1', 'target', 'node_2', 'animated', true)
        )
    );

    -- FLUJO DE BIENVENIDA
    INSERT INTO flows (id, name, trigger_word, is_active, is_default, nodes, edges)
    VALUES (welcome_id, 'Bienvenida Pollo Comilón', 'hola', true, true,
        jsonb_build_array(
            jsonb_build_object('id', 'start', 'type', 'input', 'position', jsonb_build_object('x', 500, 'y', 0), 'data', jsonb_build_object('label', 'Inicio')),
            jsonb_build_object('id', 'node_welcome', 'type', 'messageNode', 'position', jsonb_build_object('x', 500, 'y', 100), 'data', jsonb_build_object('text', '¡Hola! Bienvenido a *El Pollo Comilón* 🍗🏠.')),
            jsonb_build_object('id', 'node_poll', 'type', 'pollNode', 'position', jsonb_build_object('x', 500, 'y', 250), 'data', jsonb_build_object('question', '¿En qué podemos ayudarte hoy?', 'options', jsonb_build_array('1. Hacer pedido', '2. Consultar pedido', '3. Atención humana'), 'variable', 'user_choice')),
            jsonb_build_object('id', 'node_cond_1', 'type', 'conditionNode', 'position', jsonb_build_object('x', 200, 'y', 500), 'data', jsonb_build_object('variable', 'user_choice', 'expectedValue', '1. Hacer pedido')),
            jsonb_build_object('id', 'node_cond_2', 'type', 'conditionNode', 'position', jsonb_build_object('x', 500, 'y', 500), 'data', jsonb_build_object('variable', 'user_choice', 'expectedValue', '2. Consultar pedido')),
            jsonb_build_object('id', 'node_cond_3', 'type', 'conditionNode', 'position', jsonb_build_object('x', 800, 'y', 500), 'data', jsonb_build_object('variable', 'user_choice', 'expectedValue', '3. Atención humana')),
            jsonb_build_object('id', 'node_link_order', 'type', 'messageNode', 'position', jsonb_build_object('x', 200, 'y', 700), 'data', jsonb_build_object('text', '¡Genial! Escribe *pedir* para ver el catálogo.')),
            jsonb_build_object('id', 'node_link_consult', 'type', 'flowLinkNode', 'position', jsonb_build_object('x', 500, 'y', 700), 'data', jsonb_build_object('flowId', consult_id::text)),
            jsonb_build_object('id', 'node_link_human', 'type', 'flowLinkNode', 'position', jsonb_build_object('x', 800, 'y', 700), 'data', jsonb_build_object('flowId', human_id::text))
        ),
        jsonb_build_array(
            jsonb_build_object('id', 'e1', 'source', 'start', 'target', 'node_welcome', 'animated', true),
            jsonb_build_object('id', 'e2', 'source', 'node_welcome', 'target', 'node_poll', 'animated', true),
            jsonb_build_object('id', 'e3', 'source', 'node_poll', 'target', 'node_cond_1', 'animated', true),
            jsonb_build_object('id', 'e4', 'source', 'node_poll', 'target', 'node_cond_2', 'animated', true),
            jsonb_build_object('id', 'e5', 'source', 'node_poll', 'target', 'node_cond_3', 'animated', true),
            jsonb_build_object('id', 'e6', 'source', 'node_cond_1', 'target', 'node_link_order', 'sourceHandle', 'true', 'animated', true),
            jsonb_build_object('id', 'e7', 'source', 'node_cond_2', 'target', 'node_link_consult', 'sourceHandle', 'true', 'animated', true),
            jsonb_build_object('id', 'e8', 'source', 'node_cond_3', 'target', 'node_link_human', 'sourceHandle', 'true', 'animated', true)
        )
    );
END $$;

-- 1. CREAR EL FLUJO "TOMAR PEDIDO"
DO $$
DECLARE
    order_flow_id UUID := gen_random_uuid();
    welcome_flow_id UUID;
BEGIN
    -- Insertar el nuevo flujo de Toma de Pedidos
    INSERT INTO flows (id, name, trigger_word, is_active, nodes, edges)
    VALUES (order_flow_id, 'Tomar Pedido (Bot)', 'pedir', true,
        jsonb_build_array(
            jsonb_build_object('id', 'start', 'type', 'input', 'position', jsonb_build_object('x', 400, 'y', 0), 'data', jsonb_build_object('label', 'Inicio (pedir)')),
            jsonb_build_object('id', 'node_catalog', 'type', 'catalogNode', 'position', jsonb_build_object('x', 400, 'y', 100), 'data', jsonb_build_object('label', 'Ver Catálogo')),
            jsonb_build_object('id', 'node_summary', 'type', 'orderSummaryNode', 'position', jsonb_build_object('x', 400, 'y', 250), 'data', jsonb_build_object('label', 'Ver Resumen')),
            jsonb_build_object('id', 'node_delivery_poll', 'type', 'pollNode', 'position', jsonb_build_object('x', 400, 'y', 400), 'data', jsonb_build_object('question', '🍗 *El Pollo Comilón:* ¿Cómo querés recibir tu pedido?', 'options', jsonb_build_array('1. Envío a domicilio', '2. Retiro por el local'), 'variable', 'tipo_entrega')),
            jsonb_build_object('id', 'node_is_delivery', 'type', 'conditionNode', 'position', jsonb_build_object('x', 400, 'y', 600), 'data', jsonb_build_object('variable', 'tipo_entrega', 'expectedValue', '1. Envío a domicilio')),
            jsonb_build_object('id', 'node_address', 'type', 'questionNode', 'position', jsonb_build_object('x', 200, 'y', 800), 'data', jsonb_build_object('question', '🏠 Por favor, ingresá tu *dirección completa* (calle y altura):', 'variable', 'direccion')),
            jsonb_build_object('id', 'node_payment_poll', 'type', 'pollNode', 'position', jsonb_build_object('x', 400, 'y', 1000), 'data', jsonb_build_object('question', '💳 ¿Cómo vas a pagar?', 'options', jsonb_build_array('1. Efectivo', '2. Transferencia', '3. Mercado Pago'), 'variable', 'metodo_pago')),
            jsonb_build_object('id', 'node_create_order', 'type', 'createOrderNode', 'position', jsonb_build_object('x', 400, 'y', 1200), 'data', jsonb_build_object('label', 'Confirmar Pedido'))
        ),
        jsonb_build_array(
            jsonb_build_object('id', 'e1', 'source', 'start', 'target', 'node_catalog', 'animated', true),
            jsonb_build_object('id', 'e2', 'source', 'node_catalog', 'target', 'node_summary', 'animated', true),
            jsonb_build_object('id', 'e3', 'source', 'node_summary', 'target', 'node_delivery_poll', 'animated', true),
            jsonb_build_object('id', 'e4', 'source', 'node_delivery_poll', 'target', 'node_is_delivery', 'animated', true),
            jsonb_build_object('id', 'e5', 'source', 'node_is_delivery', 'target', 'node_address', 'sourceHandle', 'true', 'animated', true),
            jsonb_build_object('id', 'e6', 'source', 'node_is_delivery', 'target', 'node_payment_poll', 'sourceHandle', 'false', 'animated', true),
            jsonb_build_object('id', 'e7', 'source', 'node_address', 'target', 'node_payment_poll', 'animated', true),
            jsonb_build_object('id', 'e8', 'source', 'node_payment_poll', 'target', 'node_create_order', 'animated', true)
        )
    );

    -- 2. ACTUALIZAR EL FLUJO DE BIENVENIDA PARA APUNTAR AL NUEVO FLUJO
    -- Buscamos el ID del flujo de Bienvenida actual
    SELECT id INTO welcome_flow_id FROM flows WHERE name = 'Bienvenida Pollo Comilón' LIMIT 1;

    IF welcome_flow_id IS NOT NULL THEN
        -- Actualizamos los nodos para reemplazar el mensaje de "Escribe pedir" por un flowLinkNode real
        UPDATE flows 
        SET nodes = (
            SELECT jsonb_agg(
                CASE 
                    WHEN n->>'id' = 'node_link_order' THEN 
                        jsonb_build_object(
                            'id', 'node_link_order', 
                            'type', 'flowLinkNode', 
                            'position', n->'position', 
                            'data', jsonb_build_object('flowId', order_flow_id::text)
                        )
                    ELSE n 
                END
            )
            FROM jsonb_array_elements_text(nodes) AS n
        )
        WHERE id = welcome_flow_id;
        
        -- Nota: jsonb_array_elements_text devuelve el JSONB como texto, si necesitamos manipularlo como JSONB 
        -- es mejor usar JSONB_AGG con JSONB_ARRAY_ELEMENTS.
        
        UPDATE flows 
        SET nodes = (
            SELECT jsonb_agg(
                CASE 
                    WHEN ele->>'id' = 'node_link_order' THEN 
                        jsonb_build_object(
                            'id', 'node_link_order', 
                            'type', 'flowLinkNode', 
                            'position', ele->'position', 
                            'data', jsonb_build_object('flowId', order_flow_id::text)
                        )
                    ELSE ele 
                END
            )
            FROM jsonb_array_elements(nodes) AS ele
        )
        WHERE id = welcome_flow_id;

    END IF;

    RAISE NOTICE 'Flujo de pedido creado con ID: %', order_flow_id;
END $$;
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
-- Migration: Fix draft_orders missing columns
-- Description: Adds delivery_method, payment_method and metadata to draft_orders

ALTER TABLE public.draft_orders 
ADD COLUMN IF NOT EXISTS delivery_method TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Ensure these columns are accessible by the API
COMMENT ON COLUMN public.draft_orders.delivery_method IS 'The delivery method selected in the catalog';
COMMENT ON COLUMN public.draft_orders.payment_method IS 'The payment method selected in the catalog';
COMMENT ON COLUMN public.draft_orders.metadata IS 'Additional checkout metadata from the web catalog';
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
-- Migration: Create Unified Stock Flow
-- Description: Replaces the legacy stock.flow.js with a DB-driven flow using StockCheckNode and AddToCartNode.

INSERT INTO flows (name, trigger_word, is_active, nodes, edges)
VALUES (
    'Consulta de Stock',
    'stock',
    true,
    '[
        {
            "id": "start_stock",
            "type": "stockCheckNode",
            "position": { "x": 100, "y": 100 },
            "data": {
                "variable": "stock_result",
                "question": "🔍 *Consulta de Stock*\n\nEscribí el nombre del producto que buscás (ej: \"hamburguesa\")."
            }
        },
        {
            "id": "ask_add",
            "type": "pollNode",
            "position": { "x": 100, "y": 300 },
            "data": {
                "question": "¿Querés agregar este producto al pedido?",
                "options": ["Sí, agregar", "No, seguir buscando", "Ver mi carrito"],
                "variable": "confirmacion_stock"
            }
        },
        {
            "id": "check_choice",
            "type": "conditionNode",
            "position": { "x": 100, "y": 500 },
            "data": {
                "conditions": [
                    { "variable": "confirmacion_stock", "operator": "equals", "value": "Sí, agregar", "target_handle": "yes" },
                    { "variable": "confirmacion_stock", "operator": "equals", "value": "No, seguir buscando", "target_handle": "no" },
                    { "variable": "confirmacion_stock", "operator": "equals", "value": "Ver mi carrito", "target_handle": "cart" }
                ]
            }
        },
        {
            "id": "add_item",
            "type": "addToCartNode",
            "position": { "x": -100, "y": 700 },
            "data": {
                "productVariable": "stock_result"
            }
        },
        {
            "id": "goto_catalog",
            "type": "flowLinkNode",
            "position": { "x": 300, "y": 700 },
            "data": {
                "flowId": "checkout_catalogo"
            }
        }
    ]'::jsonb,
    '[
        { "id": "e1", "source": "start_stock", "target": "ask_add" },
        { "id": "e2", "source": "ask_add", "target": "check_choice" },
        { "id": "e3", "source": "check_choice", "sourceHandle": "yes", "target": "add_item" },
        { "id": "e4", "source": "check_choice", "sourceHandle": "no", "target": "start_stock" },
        { "id": "e5", "source": "check_choice", "sourceHandle": "cart", "target": "goto_catalog" },
        { "id": "e6", "source": "add_item", "target": "start_stock" }
    ]'::jsonb
);
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
