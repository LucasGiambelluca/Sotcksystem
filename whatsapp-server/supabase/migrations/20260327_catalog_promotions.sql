-- 📂 Migración: Sistema de Promociones (Banners)
-- Crea la tabla para gestionar los sliders/banners del catálogo.

CREATE TABLE IF NOT EXISTS public.catalog_promotions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    image_url text NOT NULL,
    button_text text DEFAULT 'Pedir Ahora',
    target_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.catalog_promotions ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Promociones visibles para todos" ON public.catalog_promotions
    FOR SELECT USING (true);

CREATE POLICY "Admin gestiona promociones" ON public.catalog_promotions
    FOR ALL USING (true) WITH CHECK (true);

-- Insertar ejemplo inicial (opcional)
-- INSERT INTO public.catalog_promotions (title, description, image_url, sort_order)
-- VALUES ('¡Promo Loca!', '2 Pizzas x $15.000 solo hoy', 'https://images.unsplash.com/photo-1513104890138-7c749659a591', 1);
