-- ===========================================
-- MIGRATION: Recetas y Capacidad de Producción
-- Date: 2026-03-04
-- Description: Links catalog_items to raw product ingredients.
--              Calculates how many units can be produced from current stock.
-- ===========================================

-- 1. Recipes table (one per catalog_item)
CREATE TABLE IF NOT EXISTS recipes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  catalog_item_id uuid REFERENCES catalog_items(id) ON DELETE CASCADE NOT NULL UNIQUE,
  notes text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Recipe ingredients (insumos needed per recipe)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'un', -- 'un', 'g', 'kg', 'ml', 'l'
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(recipe_id, product_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_recipes_catalog_item ON recipes(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_product ON recipe_ingredients(product_id);

-- 4. View: Production Capacity
-- For each catalog_item with a recipe, calculates the minimum producible
-- quantity across all ingredients based on current warehouse stock (products.stock).
CREATE OR REPLACE VIEW production_capacity AS
SELECT
  ci.id              AS catalog_item_id,
  ci.name            AS catalog_item_name,
  ci.category        AS category,
  ci.price           AS price,
  ci.image_url_1     AS image_url_1,
  r.id               AS recipe_id,
  r.notes            AS recipe_notes,
  -- The bottleneck: the ingredient with the least producible quantity
  MIN(FLOOR(
    CASE
      WHEN ri.unit IN ('kg') THEN (p.stock * 1000) / ri.quantity  -- convert kg→g if needed
      ELSE p.stock / ri.quantity
    END
  ))::integer        AS max_producible,
  -- The limiting ingredient name (for display)
  (
    SELECT p2.name
    FROM recipe_ingredients ri2
    JOIN products p2 ON p2.id = ri2.product_id
    WHERE ri2.recipe_id = r.id
    ORDER BY FLOOR(p2.stock / ri2.quantity) ASC
    LIMIT 1
  )                  AS bottleneck_ingredient
FROM catalog_items ci
JOIN recipes r ON r.catalog_item_id = ci.id
JOIN recipe_ingredients ri ON ri.recipe_id = r.id
JOIN products p ON p.id = ri.product_id
WHERE ci.is_active = true
GROUP BY ci.id, ci.name, ci.category, ci.price, ci.image_url_1, r.id, r.notes;
