-- Migration: Thermal Printer Integration
-- Adds a queue for print jobs and a setting for automatic printing.

-- 1. Add auto_print to whatsapp_config
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_config' AND column_name='auto_print') THEN
        ALTER TABLE whatsapp_config ADD COLUMN auto_print BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Create print_queue table
CREATE TABLE IF NOT EXISTS print_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    raw_content TEXT NOT NULL, -- Base64 encoded ESC/POS buffer
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'printed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    printed_at TIMESTAMPTZ
);

-- 3. Enable realtime for print_queue
ALTER PUBLICATION supabase_realtime ADD TABLE print_queue;

COMMENT ON TABLE print_queue IS 'Queue for thermal printer jobs to be consumed by local bridge.';

-- 4. Create printer_config table (Dynamic settings)
CREATE TABLE IF NOT EXISTS printer_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_print_enabled BOOLEAN DEFAULT true,
    margin_top INTEGER DEFAULT 0,
    margin_bottom INTEGER DEFAULT 3,
    store_name TEXT DEFAULT '@ElPolloComilon',
    footer_message TEXT DEFAULT '¡Gracias por su compra!',
    print_logo BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Enable RLS and Policies for printer_config
ALTER TABLE printer_config ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='printer_config' AND policyname='Allow all actions on printer_config') THEN
        CREATE POLICY "Allow all actions on printer_config" ON printer_config FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 6. Insert default row
INSERT INTO printer_config (store_name) 
SELECT '@ElPolloComilon'
WHERE NOT EXISTS (SELECT 1 FROM printer_config);

-- 7. Enable Realtime for printer_config
ALTER PUBLICATION supabase_realtime ADD TABLE printer_config;
