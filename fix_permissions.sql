-- PASO 1: Agregar valores a los ENUMs (Ejecutar esto primero)
-- Estos deben ejecutarse fuera de una transacción compleja si fallan.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PICKED_UP';

-- PASO 2: Crear Tipos de Logística (si no existen)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status') THEN
        CREATE TYPE assignment_status AS ENUM ('PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_priority') THEN
        CREATE TYPE assignment_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_action') THEN
        CREATE TYPE assignment_action AS ENUM ('PICKUP', 'DELIVERY');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_order_status') THEN
        CREATE TYPE assignment_order_status AS ENUM ('PENDING', 'ARRIVED', 'COMPLETED', 'FAILED');
    END IF;
END $$;

-- PASO 3: Crear Tablas
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cadete_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    status assignment_status DEFAULT 'PENDING' NOT NULL,
    priority assignment_priority DEFAULT 'NORMAL' NOT NULL,
    estimated_duration_min INTEGER,
    total_distance_km DECIMAL(8, 2),
    batch_group_id UUID,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

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

CREATE TABLE IF NOT EXISTS cadete_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
    vehicle_type TEXT DEFAULT 'moto',
    max_capacity INTEGER DEFAULT 10,
    status TEXT DEFAULT 'AVAILABLE',
    rating DECIMAL(3,2) DEFAULT 5.0,
    total_deliveries INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(employee_id)
);

CREATE TABLE IF NOT EXISTS cadete_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5, 2),
    heading INTEGER,
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- PASO 4: Permisos
GRANT ALL ON TABLE assignments TO anon, authenticated, service_role;
GRANT ALL ON TABLE assignment_orders TO anon, authenticated, service_role;
GRANT ALL ON TABLE cadete_metadata TO anon, authenticated, service_role;
GRANT ALL ON TABLE cadete_locations TO anon, authenticated, service_role;

ALTER TABLE assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE cadete_metadata DISABLE ROW LEVEL SECURITY;
ALTER TABLE cadete_locations DISABLE ROW LEVEL SECURITY;

-- PASO 5: Habilitar Realtime (Para actualizaciones automáticas)
DO $$ 
BEGIN
  -- Intentar agregar tablas a la publicación de realtime si no están
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'assignments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE assignments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'assignment_orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE assignment_orders;
  END IF;
END $$;

-- Recargar esquema
NOTIFY pgrst, 'reload schema';
