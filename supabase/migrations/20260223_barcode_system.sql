-- ============================================================
-- ENTERPRISE BARCODE SYSTEM MIGRATION
-- ============================================================

-- 1. Extend products table with barcode fields
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS barcode VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS barcode_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS barcode_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS barcode_scanned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS barcode_scan_count INTEGER DEFAULT 0;

-- 2. Create audit table for scans
CREATE TABLE IF NOT EXISTS barcode_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    barcode VARCHAR(50) NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    scan_type VARCHAR(20) CHECK (scan_type IN ('inventory', 'sale', 'lookup')),
    status VARCHAR(20) CHECK (status IN ('success', 'not_found', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Optimization indexes
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_scans_barcode ON barcode_scans(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_scans_created_at ON barcode_scans(created_at DESC);
