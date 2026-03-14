-- Migration: Add expires_at and global_variables to flow_executions for better session control
ALTER TABLE flow_executions 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS global_variables JSONB DEFAULT '{}';

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_flow_exec_expires ON flow_executions(expires_at) WHERE status IN ('active', 'waiting_input');

-- Comment explaining the columns
COMMENT ON COLUMN flow_executions.expires_at IS 'Timestamp when the session should be considered stale and ignored.';
COMMENT ON COLUMN flow_executions.global_variables IS 'Data that persists across different flows (e.g. order_id, address).';
