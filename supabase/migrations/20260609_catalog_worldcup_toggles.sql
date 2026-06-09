-- World Cup 2026 catalog toggles (per-business, optional).
-- Both default TRUE so existing catalogs keep the festive look until a client opts out.
-- NOTE: public_branding is a VIEW over whatsapp_config (not a table) -> it must be
-- recreated, not ALTERed.

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS catalog_worldcup_skin boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS catalog_loader_video  boolean NOT NULL DEFAULT true;

DROP VIEW IF EXISTS public_branding;
CREATE VIEW public_branding AS
SELECT
    welcome_message,
    whatsapp_phone,
    catalog_banner_url,
    catalog_logo_url,
    catalog_business_name,
    catalog_accent_color,
    store_lat,
    store_lng,
    catalog_worldcup_skin,
    catalog_loader_video
FROM whatsapp_config
WHERE is_active = true
LIMIT 1;

NOTIFY pgrst, 'reload schema';
