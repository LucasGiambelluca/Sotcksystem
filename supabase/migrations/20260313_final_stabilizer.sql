-- Migration: Final Bot Engine Stabilizer
-- 1. Correct columns in products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS synonyms TEXT[];
-- Ensure we don't have conflicting naming in new queries
-- (Assuming 'price' is the correct one as found in schema inspection)

-- 2. Correct columns in flow_executions for SessionRepository
ALTER TABLE public.flow_executions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- 3. Migration for existing flow_executions
UPDATE public.flow_executions 
SET session_id = '1to1:' || phone 
WHERE session_id IS NULL;

-- 4. Create trigger to auto-update updated_at (optional but good practice)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_flow_exec_updated_at ON public.flow_executions;
CREATE TRIGGER tr_flow_exec_updated_at
    BEFORE UPDATE ON public.flow_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
