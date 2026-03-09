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
