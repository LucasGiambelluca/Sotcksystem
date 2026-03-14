-- Migration: Create flow_logs for structured traceability
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

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_flow_logs_session ON flow_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_flow_logs_phone ON flow_logs(phone);
CREATE INDEX IF NOT EXISTS idx_flow_logs_created ON flow_logs(created_at);

-- Comment
COMMENT ON TABLE flow_logs IS 'Audit trail for every step taken by the flow engine.';
