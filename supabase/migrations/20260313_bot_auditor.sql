-- Migration: Create audit_logs table for bot diagnostics
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    message_id TEXT,
    user_phone TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    stack_trace TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_audit_session_time ON audit_logs(session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_user_phone ON audit_logs(user_phone);

-- Realtime enablement (optional, useful for a dashboard)
ALTER publication supabase_realtime ADD TABLE audit_logs;
