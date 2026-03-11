-- Migration: Fix draft_orders missing columns
-- Description: Adds delivery_method, payment_method and metadata to draft_orders

ALTER TABLE public.draft_orders 
ADD COLUMN IF NOT EXISTS delivery_method TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Ensure these columns are accessible by the API
COMMENT ON COLUMN public.draft_orders.delivery_method IS 'The delivery method selected in the catalog';
COMMENT ON COLUMN public.draft_orders.payment_method IS 'The payment method selected in the catalog';
COMMENT ON COLUMN public.draft_orders.metadata IS 'Additional checkout metadata from the web catalog';
