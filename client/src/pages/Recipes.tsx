import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { BookOpen, FlaskConical, Plus, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Package, X } from 'lucide-react';
import type { CatalogItem } from '../types';

/* ─── Types ──────────────────────────────────────────────── */
interface Product { id: string; name: string; stock: number; category?: string; }
interface RecipeIngredient {
  id: string;
  recipe_id: string;
  product_id: string;
  quantity: number;
  unit: string;
  product?: Product;
}
interface Recipe {
  id: string;
  catalog_item_id: string;
  notes: string | null;
  ingredients: RecipeIngredient[];
}
interface ProductionCapacity {
  catalog_item_id: string;
  catalog_item_name: string;
  category: string;
  price: number;
  image_url_1: string | null;
  recipe_id: string;
  max_producible: number;
  bottleneck_ingredient: string | null;
}

const UNITS = ['un', 'g', 'kg', 'ml', 'l', 'porciones'];

/* ─── Helper ──────────────────────────────────────────────── */

/* ─── Main Component ──────────────────────────────────────── */
export default function Recipes() {
  const [tab, setTab] = useState<'recipes' | 'capacity'>('capacity');

  // Data
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [recipes, setRecipes] = useState<Map<string, Recipe>>(new Map());
  const [products, setProducts] = useState<Product[]>([]);
  const [capacity, setCapacity] = useState<ProductionCapacity[]>([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [savingFor, setSavingFor] = useState<string | null>(null);

  // New ingredient form state (per catalog_item_id)
  const [newIngredient, setNewIngredient] = useState<Record<string, { product_id: string; quantity: string; unit: string }>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [catRes, prodRes, capRes, recipeRes, ingredientRes] = await Promise.all([
      supabase.from('catalog_items').select('*').eq('is_active', true).order('name'),
      supabase.from('products').select('id, name, stock, category').order('name'),
      supabase.from('production_capacity').select('*').order('catalog_item_name'),
      supabase.from('recipes').select('*'),
      supabase.from('recipe_ingredients').select('*, product:products(id,name,stock,category)'),
    ]);

    if (catRes.data) setCatalogItems(catRes.data as CatalogItem[]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
    if (capRes.data) setCapacity(capRes.data as ProductionCapacity[]);

    if (recipeRes.data && ingredientRes.data) {
      const map = new Map<string, Recipe>();
      for (const r of recipeRes.data) {
        map.set(r.catalog_item_id, {
          ...r,
          ingredients: (ingredientRes.data as RecipeIngredient[]).filter(i => i.recipe_id === r.id),
        });
      }
      setRecipes(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ─── Add Ingredient ──────────────────── */
  const handleAddIngredient = async (catalogItemId: string) => {
    const form = newIngredient[catalogItemId];
    if (!form?.product_id || !form?.quantity || Number(form.quantity) <= 0) {
      toast.error('Seleccioná un insumo y una cantidad válida');
      return;
    }
    setSavingFor(catalogItemId);
    try {
      let recipeId: string;
      const existing = recipes.get(catalogItemId);
      if (existing) {
        recipeId = existing.id;
      } else {
        // Create the recipe first
        const { data, error } = await supabase.from('recipes').insert({ catalog_item_id: catalogItemId }).select().single();
        if (error) throw error;
        recipeId = data.id;
      }

      const { error: ingErr } = await supabase.from('recipe_ingredients').insert({
        recipe_id: recipeId,
        product_id: form.product_id,
        quantity: Number(form.quantity),
        unit: form.unit || 'un',
      });
      if (ingErr) throw ingErr;
      toast.success('Ingrediente agregado');
      setNewIngredient(prev => ({ ...prev, [catalogItemId]: { product_id: '', quantity: '', unit: 'un' } }));
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Error al agregar ingrediente');
    } finally {
      setSavingFor(null);
    }
  };

  /* ─── Remove Ingredient ───────────────── */
  const handleRemoveIngredient = async (ingredientId: string, _catalogItemId: string) => {
    const { error } = await supabase.from('recipe_ingredients').delete().eq('id', ingredientId);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Ingrediente eliminado');
    // If no more ingredients, optionally delete the recipe too
    await loadAll();
  };

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="flex items-center gap-3 text-primary-600">
        <FlaskConical className="animate-pulse" size={24} />
        <span>Cargando recetas...</span>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <FlaskConical className="text-primary-600" size={28} />
          Recetas y Producción
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Definí los insumos que necesita cada elaborado y mirá cuántas unidades podés producir hoy.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setTab('capacity')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'capacity' ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📊 Capacidad de Producción
        </button>
        <button
          onClick={() => setTab('recipes')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'recipes' ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          📋 Gestionar Recetas
        </button>
      </div>

      {/* TAB: Production Capacity */}
      {tab === 'capacity' && (
        <div className="space-y-3">
          {capacity.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
              <FlaskConical size={40} className="text-amber-400 mx-auto mb-3" />
              <p className="font-semibold text-amber-800">No hay recetas definidas aún</p>
              <p className="text-sm text-amber-600 mt-1">Andá a "Gestionar Recetas" para empezar a definir los insumos de cada elaborado.</p>
              <button
                onClick={() => setTab('recipes')}
                className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition"
              >
                Definir Recetas →
              </button>
            </div>
          ) : (
            capacity.map(item => {
              const qty = item.max_producible ?? 0;
              const color = qty > 5 ? 'green' : qty >= 2 ? 'yellow' : qty === 1 ? 'orange' : 'red';
              const colorMap = {
                green: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-800', icon: <CheckCircle size={18} className="text-green-500" />, label: 'Disponible' },
                yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-800', icon: <AlertTriangle size={18} className="text-yellow-500" />, label: 'Stock bajo' },
                orange: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800', icon: <AlertTriangle size={18} className="text-orange-500" />, label: '¡Último!' },
                red: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800', icon: <AlertTriangle size={18} className="text-red-500" />, label: 'Sin stock' },
              };
              const c = colorMap[color];

              return (
                <div key={item.catalog_item_id} className={`${c.bg} border ${c.border} rounded-2xl p-4 flex items-center gap-4`}>
                  {/* Image */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    {item.image_url_1
                      ? <img src={item.image_url_1} alt={item.catalog_item_name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Package size={20} className="text-gray-300" /></div>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{item.catalog_item_name}</p>
                    <div className="flex items-center flex-wrap gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.badge}`}>
                        {c.label}
                      </span>
                      {item.bottleneck_ingredient && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Package size={11} />
                          Limitante: <strong>{item.bottleneck_ingredient}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Big counter */}
                  <div className="text-right shrink-0">
                    <div className={`text-4xl font-black leading-none ${color === 'red' ? 'text-red-600' : color === 'orange' ? 'text-orange-600' : color === 'yellow' ? 'text-yellow-700' : 'text-green-700'}`}>
                      {qty}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">unidades</div>
                  </div>
                </div>
              );
            })
          )}

          {/* Items without recipes */}
          {catalogItems.filter(ci => !recipes.has(ci.id)).length > 0 && (
            <div className="mt-4 border border-dashed border-gray-300 rounded-2xl p-4">
              <p className="text-sm text-gray-400 font-medium mb-2">Sin receta definida:</p>
              <div className="flex flex-wrap gap-2">
                {catalogItems.filter(ci => !recipes.has(ci.id)).map(ci => (
                  <button
                    key={ci.id}
                    onClick={() => { setTab('recipes'); setExpandedItem(ci.id); }}
                    className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-200 transition"
                  >
                    + Definir receta de "{ci.name}"
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Recipe Editor */}
      {tab === 'recipes' && (
        <div className="space-y-3">
          {catalogItems.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p>No hay ítems en el catálogo de ventas.</p>
            </div>
          )}
          {catalogItems.map(item => {
            const recipe = recipes.get(item.id);
            const isExpanded = expandedItem === item.id;
            const ing = newIngredient[item.id] || { product_id: '', quantity: '', unit: 'un' };

            return (
              <div key={item.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                {/* Item Header */}
                <button
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    {item.image_url_1
                      ? <img src={item.image_url_1} alt={item.name} className="w-full h-full object-cover" />
                      : <Package size={18} className="text-gray-300 m-auto mt-2.5" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {recipe ? (
                        <span className="text-primary-600 font-medium">
                          ✓ {recipe.ingredients.length} ingrediente{recipe.ingredients.length !== 1 ? 's' : ''} definido{recipe.ingredients.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-amber-500">Sin receta · Hacé click para agregar</span>
                      )}
                    </p>
                  </div>
                  <span className="text-gray-400">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </span>
                </button>

                {/* Expanded: Ingredient Editor */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-4">
                    {/* Existing Ingredients */}
                    {recipe && recipe.ingredients.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ingredientes actuales</p>
                        {recipe.ingredients.map(ing => (
                          <div key={ing.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100">
                            <Package size={16} className="text-gray-400 shrink-0" />
                            <div className="flex-1">
                              <span className="text-sm font-semibold text-gray-800">{ing.product?.name || '—'}</span>
                              <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                {ing.quantity} {ing.unit}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">
                              Stock: <strong className={ing.product && ing.product.stock > 0 ? 'text-green-600' : 'text-red-500'}>{ing.product?.stock ?? '?'}</strong>
                            </span>
                            <button
                              onClick={() => handleRemoveIngredient(ing.id, item.id)}
                              className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new ingredient form */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Agregar Ingrediente</p>
                      <div className="flex gap-2 flex-wrap">
                        {/* Insumo Select */}
                        <select
                          value={ing.product_id}
                          onChange={e => setNewIngredient(prev => ({ ...prev, [item.id]: { ...ing, product_id: e.target.value } }))}
                          className="flex-1 min-w-[160px] px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        >
                          <option value="">Seleccionar insumo...</option>
                          {products
                            .filter(p => !recipe?.ingredients.some(ri => ri.product_id === p.id))
                            .map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Stock: {p.stock})
                              </option>
                            ))
                          }
                        </select>

                        {/* Quantity */}
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Cant."
                          value={ing.quantity}
                          onChange={e => setNewIngredient(prev => ({ ...prev, [item.id]: { ...ing, quantity: e.target.value } }))}
                          className="w-20 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        />

                        {/* Unit */}
                        <select
                          value={ing.unit}
                          onChange={e => setNewIngredient(prev => ({ ...prev, [item.id]: { ...ing, unit: e.target.value } }))}
                          className="w-24 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        >
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>

                        {/* Add button */}
                        <button
                          onClick={() => handleAddIngredient(item.id)}
                          disabled={savingFor === item.id}
                          className="flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 shadow-sm transition-all disabled:opacity-50 shrink-0"
                        >
                          {savingFor === item.id ? (
                            <span className="animate-pulse">Guardando...</span>
                          ) : (
                            <><Plus size={16} /> Agregar</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
