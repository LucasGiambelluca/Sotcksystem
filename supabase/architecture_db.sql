-- 1. Add new columns to chat_sessions without breaking existing data
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS lid_mapping TEXT,
ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS timeout_warning_sent BOOLEAN DEFAULT FALSE;

-- 2. Create index for fast Identity Resolution
CREATE INDEX IF NOT EXISTS idx_chat_sessions_lid_mapping ON chat_sessions(lid_mapping);

-- 3. Atomic Session Retrieval RPC (The "Check-then-Act" Lock)
CREATE OR REPLACE FUNCTION get_and_lock_session(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    r_session chat_sessions%ROWTYPE;
BEGIN
    -- Try to lock the row for this phone
    -- SKIP LOCKED ensures we don't wait forever if another process is stuck, 
    -- but usually for a specific phone, we want to wait a bit or fail fast.
    -- For this bot, standard FOR UPDATE is safer to ensure serialization.
    
    SELECT * INTO r_session
    FROM chat_sessions
    WHERE phone = p_phone
    FOR UPDATE; -- Locks this row until transaction commit

    -- If no session exists, we don't create one here (router does that), 
    -- we just return null to indicate "Idle".
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Return the session data
    RETURN to_jsonb(r_session);
END;
$$;

-- 4. Cleanup Function for Stale Sessions
CREATE OR REPLACE FUNCTION cleanup_stale_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Delete really old sessions (dead)
    DELETE FROM chat_sessions 
    WHERE (status = 'timeout' OR status = 'idle')
    AND last_activity < NOW() - INTERVAL '24 hours';

    -- Mark active sessions as timed out
    UPDATE chat_sessions 
    SET status = 'timeout',
        temp_data = '{}'::jsonb,
        current_flow_id = NULL,
        current_node_id = NULL
    WHERE status != 'timeout'
    AND timeout_at < NOW()
    AND timeout_warning_sent = TRUE;
END;
$$;
