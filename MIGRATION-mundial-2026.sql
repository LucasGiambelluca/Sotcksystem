-- ============================================================================
--  MIGRACION: Catalogo Mundial 2026  (skin + video de carga, toggles por cliente)
--  Fecha: 2026-06-09
--
--  COMO APLICAR EN PRODUCCION:
--    Pegar TODO este archivo en el SQL Editor de CADA proyecto Supabase
--    (uno por cliente / tenant) y ejecutar. Es idempotente: se puede correr
--    varias veces sin romper nada.
--
--  QUE HACE:
--    1) Agrega 2 columnas boolean (default true) a la tabla maestra
--       whatsapp_config.
--    2) Recrea la VIEW public_branding (que lee el catalogo publico) para que
--       exponga esas 2 columnas. OJO: public_branding es una VIEW, no una
--       tabla -> NO se le puede hacer ALTER ADD COLUMN, hay que recrearla.
--
--    Default true => los catalogos existentes mantienen la skin y el video del
--    Mundial hasta que el cliente los apague desde el panel
--    (Configuracion -> Catalogo -> "Mundial 2026").
--
--    El resto de la feature (video de carga, banderines, franja celeste/blanco,
--    fondo festivo) es 100% frontend: sin cambios de base de datos.
-- ============================================================================

-- 1) Tabla maestra de config (la que persiste el panel de administracion)
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS catalog_worldcup_skin boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS catalog_loader_video  boolean NOT NULL DEFAULT true;

-- 2) Recrear la VIEW publica con las 2 columnas nuevas al final.
--    (mismas columnas que la def vigente + los 2 toggles)
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

-- 3) Refrescar el cache de esquema de PostgREST para que la API vea los cambios
NOTIFY pgrst, 'reload schema';

-- ── Verificacion (opcional) ──
-- SELECT catalog_worldcup_skin, catalog_loader_video FROM public_branding;
