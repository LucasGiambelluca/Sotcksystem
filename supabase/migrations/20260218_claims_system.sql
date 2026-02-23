
-- Create claims table
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id),
    type VARCHAR(50) DEFAULT 'general', -- 'complaint', 'suggestion', 'issue'
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'in_progress', 'resolved'
    description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_claims_client_id ON claims(client_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

-- RLS (Optional for now, but good practice)
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read/write for authenticated users only" ON claims
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Public access (if needed for public facing pages, but admin panel is auth)
-- For now, allow public verify via API functions if needed.
