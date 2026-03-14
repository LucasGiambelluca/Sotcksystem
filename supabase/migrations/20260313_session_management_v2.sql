-- Migration: Enhance flow_executions for robust session management
-- 1. Add columns for optimistic locking and archiving
ALTER TABLE flow_executions 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS archived_reason TEXT;

-- 2. Backfill session_id if empty (using phone for existing sessions)
UPDATE flow_executions SET session_id = '1to1:' || phone WHERE session_id IS NULL;

-- 3. Make session_id NOT NULL for future entries
ALTER TABLE flow_executions ALTER COLUMN session_id SET NOT NULL;

-- 4. Create History Table for archived sessions
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

-- Indices for history
CREATE INDEX IF NOT EXISTS idx_flow_exec_hist_session ON flow_executions_history(session_id);
CREATE INDEX IF NOT EXISTS idx_flow_exec_hist_phone ON flow_executions_history(phone);
