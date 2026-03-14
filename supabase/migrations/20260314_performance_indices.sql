-- Migration: Add indices for high-performance session lookups
-- 1. Index for primary session lookup (used by everything)
CREATE INDEX IF NOT EXISTS idx_flow_exec_session_id ON flow_executions(session_id);

-- 2. Index for phone + status (used by forceReset and lookups)
CREATE INDEX IF NOT EXISTS idx_flow_exec_phone_status ON flow_executions(phone, status);

-- 3. Index for updated_at (used for sorting and cleaning stale sessions)
CREATE INDEX IF NOT EXISTS idx_flow_exec_updated ON flow_executions(updated_at DESC);

-- 4. Index for trigger_word (faster flow lookup)
CREATE INDEX IF NOT EXISTS idx_flows_trigger_all ON flows(trigger_word);

-- Comment
COMMENT ON INDEX idx_flow_exec_session_id IS 'Speeds up the direct session lookup which happens on every message.';
