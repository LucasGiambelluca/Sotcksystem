-- Migration to add checkout_message to whatsapp_config
ALTER TABLE public.whatsapp_config
ADD COLUMN IF NOT EXISTS checkout_message TEXT DEFAULT 'El pedido ya fue enviado a cocina.';
