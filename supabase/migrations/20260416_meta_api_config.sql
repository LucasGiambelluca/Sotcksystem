-- Add Meta WhatsApp Cloud API credentials to whatsapp_config
-- These allow configuring the Official API from the admin panel instead of .env

ALTER TABLE "public"."whatsapp_config" 
ADD COLUMN IF NOT EXISTS "meta_cloud_token" TEXT,
ADD COLUMN IF NOT EXISTS "meta_phone_number_id" TEXT,
ADD COLUMN IF NOT EXISTS "meta_app_secret" TEXT,
ADD COLUMN IF NOT EXISTS "meta_verify_token" TEXT DEFAULT 'SotckSystemToken2026';
