-- FINAL RECONCILIATION: Ensure all required columns and tables exist for the Bot Diagnostic Plan
-- 1. Table flow_executions: Ensure new columns exist
DO $$ 
BEGIN
    -- status column (should exist but ensure proper defaults)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flow_executions' AND column_name='status') THEN
        ALTER TABLE flow_executions ADD COLUMN status VARCHAR(20) DEFAULT 'active';
    END IF;

    -- archived_reason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flow_executions' AND column_name='archived_reason') THEN
        ALTER TABLE flow_executions ADD COLUMN archived_reason TEXT;
    END IF;

    -- session_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flow_executions' AND column_name='session_id') THEN
        ALTER TABLE flow_executions ADD COLUMN session_id TEXT;
        UPDATE flow_executions SET session_id = '1to1:' || phone WHERE session_id IS NULL;
        ALTER TABLE flow_executions ALTER COLUMN session_id SET NOT NULL;
    END IF;

    -- version
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flow_executions' AND column_name='version') THEN
        ALTER TABLE flow_executions ADD COLUMN version INTEGER DEFAULT 0;
    END IF;

    -- expires_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flow_executions' AND column_name='expires_at') THEN
        ALTER TABLE flow_executions ADD COLUMN expires_at TIMESTAMPTZ;
    END IF;

    -- global_variables
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='flow_executions' AND column_name='global_variables') THEN
        ALTER TABLE flow_executions ADD COLUMN global_variables JSONB DEFAULT '{}';
    END IF;
END $$;

-- 2. History Table: flow_executions_history
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

-- 3. Flow Logs Table
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

-- 4. Audit Table (Used by SessionAuditor.ts)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    session_id TEXT,
    event_type TEXT,
    message_id TEXT,
    user_phone TEXT,
    details JSONB,
    stack_trace TEXT
);

-- 5. Performance Indices
CREATE INDEX IF NOT EXISTS idx_flow_exec_session_id ON flow_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_flow_exec_phone_status ON flow_executions(phone, status);
CREATE INDEX IF NOT EXISTS idx_flow_exec_expires ON flow_executions(expires_at) WHERE status IN ('active', 'waiting_input');
CREATE INDEX IF NOT EXISTS idx_flow_logs_session ON flow_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON audit_logs(session_id);

-- 6. Atomic Stock Decrement Function
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
    
    SELECT stock INTO current_stock FROM catalog_items WHERE id = p_id FOR UPDATE;

    IF current_stock IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', p_id;
    END IF;

    IF current_stock < p_qty THEN
      RAISE EXCEPTION 'Insuficiente stock. Producto: % (Disponible: %, Solicitado: %)', p_id, current_stock, p_qty;
    END IF;

    UPDATE catalog_items SET stock = stock - p_qty, updated_at = NOW() WHERE id = p_id;
  END LOOP;
  RETURN TRUE;
END;
$$;
