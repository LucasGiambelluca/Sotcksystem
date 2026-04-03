-- 1. FIX: WhatsApp Bot Session Management
ALTER TABLE flow_executions 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS archived_reason TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS global_variables JSONB DEFAULT '{}';

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_flow_exec_session_id ON flow_executions(session_id);

-- 2. FIX: Logistics Strategy (LIV) Columns
ALTER TABLE whatsapp_config 
ADD COLUMN IF NOT EXISTS shipping_policy TEXT DEFAULT 'flex',
ADD COLUMN IF NOT EXISTS store_lat NUMERIC,
ADD COLUMN IF NOT EXISTS store_lng NUMERIC,
ADD COLUMN IF NOT EXISTS store_address TEXT,
ADD COLUMN IF NOT EXISTS store_city TEXT DEFAULT 'Bahía Blanca',
ADD COLUMN IF NOT EXISTS store_province TEXT DEFAULT 'Buenos Aires',
ADD COLUMN IF NOT EXISTS store_country TEXT DEFAULT 'Argentina';

-- 3. FIX: Neighborhood Selector & Polygon Support
ALTER TABLE shipping_zones 
ADD COLUMN IF NOT EXISTS polygon JSONB,
ADD COLUMN IF NOT EXISTS allow_delivery BOOLEAN DEFAULT true;

-- 4. SUPPORT TABLES: History & Logs
CREATE TABLE IF NOT EXISTS flow_executions_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_id UUID,
    flow_id UUID,
    phone TEXT,
    session_id TEXT,
    current_node_id TEXT,
    status TEXT,
    context JSONB,
    started_at TIMESTAMPTZ,
    last_activity TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ DEFAULT NOW(),
    archived_reason TEXT,
    version INTEGER
);

CREATE TABLE IF NOT EXISTS flow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    session_id TEXT NOT NULL,
    phone TEXT,
    flow_id TEXT,
    node_id TEXT,
    node_type TEXT,
    input_text TEXT,
    output_messages JSONB DEFAULT '[]',
    execution_time_ms INTEGER,
    metadata JSONB DEFAULT '{}'
);
