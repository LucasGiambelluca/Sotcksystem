-- Add jid column to whatsapp_conversations for proper LID support
-- LID (Linked Identity) is used by newer WhatsApp versions through Baileys
-- The jid stores the full WhatsApp JID (e.g., "5492915093499@s.whatsapp.net" or "17629553937616@lid")
-- This allows sending messages back to the correct JID regardless of phone format

ALTER TABLE "public"."whatsapp_conversations" 
ADD COLUMN IF NOT EXISTS "jid" TEXT;

-- Create index for fast JID lookups
CREATE INDEX IF NOT EXISTS idx_conversations_jid ON "public"."whatsapp_conversations" (jid);
