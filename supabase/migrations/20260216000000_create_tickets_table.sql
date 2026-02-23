-- Migration: Create Professional Tickets table
-- Description: Stores rich ticket data including SLA, Context, and Priority.

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identification
    phone VARCHAR(50) NOT NULL,
    customer_name VARCHAR(100),
    
    -- Content
    subject VARCHAR(200),            -- Summary/Title
    description TEXT,                -- Full details
    category VARCHAR(50),            -- 'producto', 'servicio', 'pagos', 'envios', 'otro'
    priority VARCHAR(20) DEFAULT 'medium',   -- 'low', 'medium', 'high', 'critical'
    
    -- Context (Critical for Bot)
    flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
    node_id VARCHAR(100),
    context_snapshot JSONB DEFAULT '{}'::jsonb, -- Store cart, variables at moment of creation
    last_message TEXT,
    
    -- Management
    status VARCHAR(20) DEFAULT 'open',       -- 'open', 'in_progress', 'resolved', 'closed'
    assigned_to UUID,                        -- Agent ID (Link to auth.users if using Supabase Auth, or just string if external)
    resolution_notes TEXT,
    
    -- SLA / Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    due_at TIMESTAMP WITH TIME ZONE,         -- Deadline
    
    -- Loop Closure
    customer_notified BOOLEAN DEFAULT false
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_phone ON tickets(phone);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);

-- Enable Realtime for this table (Check Supabase Dashboard to confirm 'tickets' is in published tables, but RLS/Policies enable access)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Policies (Adjust based on your Auth setup)
CREATE POLICY "Enable read/write for verified users" ON tickets
    FOR ALL USING (true) WITH CHECK (true); -- Public/Service Role for now.
