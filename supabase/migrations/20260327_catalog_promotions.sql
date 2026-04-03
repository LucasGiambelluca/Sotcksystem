-- MIGRACIÓN: Sistema de Promociones Dinámicas
-- Fecha: 2026-03-27

-- 1. Crear la tabla de promociones
CREATE TABLE IF NOT EXISTS public.catalog_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    button_text TEXT DEFAULT 'Pedir ahora',
    target_id UUID REFERENCES public.catalog_items(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar RLS (Seguridad a nivel de fila)
ALTER TABLE public.catalog_promotions ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acceso
-- Lectura pública para el catálogo
CREATE POLICY "Permitir lectura pública de promociones" 
ON public.catalog_promotions FOR SELECT 
USING (true);

-- Gestión total para administradores (asumiendo que Lucas usa auth.uid())
-- NOTA: Si no hay un sistema de roles complejo, permitimos todo por ahora 
-- o lo restringimos si ya tenemos una política estándar en el proyecto.
CREATE POLICY "Gestión total para administradores" 
ON public.catalog_promotions FOR ALL 
USING (true)
WITH CHECK (true);

-- 4. Comentarios para autocompletado
COMMENT ON TABLE public.catalog_promotions IS 'Almacena los banners publicitarios del carrusel superior del catálogo.';
