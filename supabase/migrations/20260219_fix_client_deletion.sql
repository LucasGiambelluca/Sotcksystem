-- Migration: 20260219_fix_client_deletion.sql
-- Description: Allow deleting clients by changing strict FK constraints to SET NULL or CASCADE.

-- 1. ORDERS: Keep orders but unlink from client (financial history)
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_client_id_fkey;

ALTER TABLE orders
ADD CONSTRAINT orders_client_id_fkey
FOREIGN KEY (client_id)
REFERENCES clients(id)
ON DELETE SET NULL;

-- 2. WHATSAPP CONVERSATIONS: Delete chats if client is deleted (or unlink?)
-- Usually if I delete a client I expect their chat to go or just unlink.
-- Current schema says SET NULL. If it was blocking, it might be another constraint.
-- Let's ensure it is SET NULL or CASCADE.
ALTER TABLE whatsapp_conversations
DROP CONSTRAINT IF EXISTS whatsapp_conversations_client_id_fkey;

ALTER TABLE whatsapp_conversations
ADD CONSTRAINT whatsapp_conversations_client_id_fkey
FOREIGN KEY (client_id)
REFERENCES clients(id)
ON DELETE SET NULL;

-- 3. CLAIMS: Keep claims but unlink
-- Check if claims table exists first (it was added in a recent migration)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claims') THEN
        ALTER TABLE claims
        DROP CONSTRAINT IF EXISTS claims_client_id_fkey;

        ALTER TABLE claims
        ADD CONSTRAINT claims_client_id_fkey
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 4. MOVEMENTS: Already CASCADE in schema, but ensuring it.
ALTER TABLE movements
DROP CONSTRAINT IF EXISTS movements_client_id_fkey;

ALTER TABLE movements
ADD CONSTRAINT movements_client_id_fkey
FOREIGN KEY (client_id)
REFERENCES clients(id)
ON DELETE CASCADE;
