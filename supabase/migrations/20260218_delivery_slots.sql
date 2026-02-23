-- Migration: 20260218_delivery_slots
-- Description: Create delivery_slots table and add relation to orders

-- 1. Create delivery_slots table
CREATE TABLE IF NOT EXISTS delivery_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    time_start TIME NOT NULL,
    time_end TIME NOT NULL,
    max_orders INTEGER DEFAULT 5,
    orders_count INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    cut_off_minutes INTEGER DEFAULT 30,
    version INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, time_start)
);

-- 2. Add delivery_slot_id to orders
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_slot_id') THEN
        ALTER TABLE orders ADD COLUMN delivery_slot_id UUID REFERENCES delivery_slots(id);
    END IF;
END $$;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_slots_date_time ON delivery_slots(date, time_start);
