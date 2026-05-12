-- Migration: Add paper_width to printer_config
ALTER TABLE printer_config ADD COLUMN IF NOT EXISTS paper_width INTEGER DEFAULT 80;
COMMENT ON COLUMN printer_config.paper_width IS 'Ancho del papel en mm (58 o 80)';
