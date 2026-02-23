-- Add Sileo configuration column to whatsapp_config
ALTER TABLE "public"."whatsapp_config" ADD COLUMN IF NOT EXISTS "sileo_api_key" VARCHAR(255);
