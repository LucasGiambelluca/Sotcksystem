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
