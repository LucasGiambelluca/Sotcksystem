-- CREATE lid_mappings table (Missing from previous migration)
CREATE TABLE IF NOT EXISTS lid_mappings (
    lid TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups (though PK is indexed by default)
CREATE INDEX IF NOT EXISTS idx_lid_mappings_phone ON lid_mappings(phone);

-- Grant permissions if necessary (usually public has access in dev, but good to ensure)
ALTER TABLE lid_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON lid_mappings FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON lid_mappings FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON lid_mappings FOR UPDATE USING (true);
