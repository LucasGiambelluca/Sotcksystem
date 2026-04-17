-- Migration: Add extra Meta Business columns for Embedded Signup flow
-- These columns store IDs, encrypted tokens, and metadata returned by the Meta OAuth flow.

ALTER TABLE "public"."whatsapp_config"
ADD COLUMN IF NOT EXISTS "meta_waba_id" TEXT,
ADD COLUMN IF NOT EXISTS "meta_business_id" TEXT,
ADD COLUMN IF NOT EXISTS "meta_token_encrypted" TEXT,
ADD COLUMN IF NOT EXISTS "meta_token_expires_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "meta_display_name" TEXT,
ADD COLUMN IF NOT EXISTS "meta_quality_rating" TEXT,
ADD COLUMN IF NOT EXISTS "connection_method" TEXT DEFAULT 'qr' CHECK (connection_method IN ('qr', 'embedded_signup'));

-- Description:
-- meta_waba_id: WhatsApp Business Account ID
-- meta_business_id: Meta Business Portfolio ID
-- meta_token_encrypted: Long-lived token encrypted with EncryptionService
-- connection_method: Allows the system to know if it should use Baileys or WhatsApp Cloud API
