-- ===========================================
-- MIGRATION: Add phone to employees
-- Date: 2026-03-08
-- Description: Adds phone column to support logistics notifications
-- ===========================================

ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS phone text;

-- Recargar caché de PostgREST
NOTIFY pgrst, 'reload schema';
