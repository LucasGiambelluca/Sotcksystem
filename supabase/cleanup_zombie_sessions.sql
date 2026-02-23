
-- Function to clean up zombie sessions (older than 2 hours)
CREATE OR REPLACE FUNCTION cleanup_zombie_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE conversation_brain
  SET status = 'timeout',
      last_activity = NOW()
  WHERE status IN ('active', 'waiting_input')
    AND last_activity < NOW() - INTERVAL '2 hours';
END;
$$;
