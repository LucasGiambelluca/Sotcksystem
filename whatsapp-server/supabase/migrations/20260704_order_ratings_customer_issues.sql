-- MIGRACIÓN: Tablas para calificaciones y reportes de problemas desde WhatsApp
-- Fecha: 2026-07-04
--
-- Contexto: los botones interactivos de las notificaciones de pedido
-- (⭐⭐⭐⭐⭐ / "Tuve un problema") ahora persisten datos:
--   - order_ratings: calificación del cliente al recibir el pedido (rate_1..rate_5)
--   - customer_issues: el bot ya intentaba insertar acá (ShortcutsManager.reportIssue)
--     pero la tabla podía no existir; se crea idempotente.
--
-- Escribe solo el servidor del bot (service role, bypassa RLS). El panel lee
-- como usuario autenticado. Sin acceso anon.

-- 1. Calificaciones de pedidos
CREATE TABLE IF NOT EXISTS public.order_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number text,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  source text NOT NULL DEFAULT 'whatsapp_button',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_ratings_order_id ON public.order_ratings(order_id);
CREATE INDEX IF NOT EXISTS idx_order_ratings_created_at ON public.order_ratings(created_at DESC);

ALTER TABLE public.order_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_ratings_admin_read" ON public.order_ratings;
CREATE POLICY "order_ratings_admin_read"
ON public.order_ratings
FOR SELECT
TO authenticated
USING (true);

-- 2. Reportes de problemas de clientes
CREATE TABLE IF NOT EXISTS public.customer_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number text,
  issue_type text NOT NULL DEFAULT 'customer_reported_via_whatsapp',
  description text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_issues_status ON public.customer_issues(status);
CREATE INDEX IF NOT EXISTS idx_customer_issues_created_at ON public.customer_issues(created_at DESC);

ALTER TABLE public.customer_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_issues_admin_all" ON public.customer_issues;
CREATE POLICY "customer_issues_admin_all"
ON public.customer_issues
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
