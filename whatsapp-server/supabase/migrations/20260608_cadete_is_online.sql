-- Cadete online status: add boolean column used by the panel/PWA.
ALTER TABLE cadete_metadata ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
