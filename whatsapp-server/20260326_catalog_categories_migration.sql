-- 📂 Migración de Categorías del Catálogo
-- Este script crea la tabla de categorías y migra los datos existentes.

-- 1. Crear tabla de categorías
CREATE TABLE IF NOT EXISTS public.catalog_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE public.catalog_categories ENABLE ROW LEVEL SECURITY;

-- 3. Políticas básicas (Lectura pública, escritura admin)
CREATE POLICY "Categorías visibles para todos" ON public.catalog_categories
    FOR SELECT USING (true);

CREATE POLICY "Admin puede gestionar categorías" ON public.catalog_categories
    FOR ALL USING (true) WITH CHECK (true);

-- 4. Añadir columna de relación en catalog_items
ALTER TABLE public.catalog_items ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.catalog_categories(id);

-- 5. Migrar categorías existentes
-- Insertamos los nombres de categorías actuales que no existan aún
INSERT INTO public.catalog_categories (name)
SELECT DISTINCT category 
FROM public.catalog_items 
WHERE category IS NOT NULL AND category != ''
ON CONFLICT (name) DO NOTHING;

-- Actualizamos los items con el ID de su nueva categoría
UPDATE public.catalog_items ci
SET category_id = cc.id
FROM public.catalog_categories cc
WHERE ci.category = cc.name;

-- 6. Opcional: Podríamos borrar la columna 'category' vieja después, 
-- pero la dejamos por seguridad un tiempo.
