-- Add conversation status for Bot vs Handover
ALTER TABLE "public"."whatsapp_conversations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT 'BOT';

-- Comment: Status can be 'BOT' or 'HANDOVER'
