-- Migration: Create tables for Hybrid Flow Engine
-- Description: Stores visual flow definitions and execution state

-- 1. Table: flows (The definition of a flow)
CREATE TABLE IF NOT EXISTS flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_word VARCHAR(100), -- e.g. "hola", "menu"
    trigger_type VARCHAR(20) DEFAULT 'exact', -- 'exact', 'contains', 'regex'
    is_active BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false, -- If no trigger matches, use this
    
    -- Visual Editor Data (React Flow)
    nodes JSONB DEFAULT '[]'::jsonb,
    edges JSONB DEFAULT '[]'::jsonb,
    viewport JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by trigger
CREATE INDEX IF NOT EXISTS idx_flows_trigger ON flows(trigger_word) WHERE is_active = true;

-- 2. Table: flow_executions (State of a user in a flow)
CREATE TABLE IF NOT EXISTS flow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
    phone VARCHAR(50) NOT NULL,
    
    current_node_id VARCHAR(100), -- The ID of the node in the JSON
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'error'
    
    context JSONB DEFAULT '{}'::jsonb, -- Variables gathered (name, order items, etc)
    
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for looking up active sessions
CREATE INDEX IF NOT EXISTS idx_flow_executions_active ON flow_executions(phone) WHERE status = 'active';

-- Support for RLS (Optional, likely needed for Supabase)
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_executions ENABLE ROW LEVEL SECURITY;

-- Allow public access for now (or Service Role will bypass this)
CREATE POLICY "Enable all access for service role" ON flows
    FOR ALL USING (true) WITH CHECK (true);
    
CREATE POLICY "Enable all access for service role" ON flow_executions
    FOR ALL USING (true) WITH CHECK (true);
