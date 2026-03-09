import { useEffect, useState, useRef } from 'react';
import { ShoppingCart, X, Plus, Minus, ChevronLeft, ChevronRight, MessageCircle, Search, Store } from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { PublicCatalogItem } from '../types';

/* ─── Types ─────────────────────────────────────────────────── */
interface CartItem {
  product: PublicCatalogItem;
  quantity: number;
  notes: string;
}

interface BusinessConfig {
  welcome_message?: string;
  whatsapp_phone?: string;
  catalog_banner_url?: string;
  catalog_logo_url?: string;
  catalog_business_name?: string;
  catalog_accent_color?: string;
}

/* ─── Helpers ────────────────────────────────────────────────── */
const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;

/* ─── Image Slideshow sub-component ─────────────────────────── */
function ProductImage({ url1, url2, alt, className = '' }: {
  url1?: string | null; url2?: string | null; alt: string; className?: string
}) {
  const [idx, setIdx] = useState(0);
  const images = [url1, url2].filter(Boolean) as string[];
  if (images.length === 0) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <Store size={40} className="text-gray-300" />
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img src={images[idx]} alt={alt} className="w-full h-full object-cover transition-all duration-300" />
      {images.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); setIdx(0); }}
            className={`absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-0.5 ${idx === 0 ? 'opacity-30' : 'opacity-80 hover:opacity-100'}`}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); setIdx(1); }}
            className={`absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-0.5 ${idx === 1 ? 'opacity-30' : 'opacity-80 hover:opacity-100'}`}>
            <ChevronRight size={14} />
          </button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/40'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function Catalog() {
  const [products, setProducts] = useState<PublicCatalogItem[]>([]);
  const [config, setConfig] = useState<BusinessConfig>({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PublicCatalogItem | null>(null);
  const [productNotes, setProductNotes] = useState('');
  const [productQty, setProductQty] = useState(1);
  
  // Checkout Modal States
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('Delivery');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');

  const categoryBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [{ data: prods }, { data: cfg }] = await Promise.all([
      supabase.from('public_catalog').select('*').order('is_special', { ascending: false }).order('category').order('name'),
      supabase.from('public_branding').select('*').maybeSingle()
    ]);
    if (prods) setProducts(prods as PublicCatalogItem[]);
    if (cfg) setConfig(cfg as BusinessConfig);
    setLoading(false);
  }

  /* ─── Derived State ─────── */
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const rawCategories = Array.from(new Set(filtered.map(p => p.category).filter(Boolean))) as string[];
  const specials = filtered.filter(p => p.is_special);
  const categories = specials.length > 0 ? ['⭐ Especiales', ...rawCategories] : rawCategories;

  const grouped = categories.reduce((acc, cat) => {
    const items = cat === '⭐ Especiales' 
      ? specials 
      : filtered.filter(p => p.category === cat);
    
    if (items.length) acc[cat] = items;
    return acc;
  }, {} as Record<string, PublicCatalogItem[]>);

  // If there are no categories but there are products, group them under "Productos"
  const finalGrouped = Object.keys(grouped).length > 0 
    ? grouped 
    : (filtered.length > 0 ? { 'Productos': filtered } : {});

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => {
    const price = i.product.is_special && i.product.special_price ? i.product.special_price : i.product.price;
    return s + price * i.quantity;
  }, 0);

  /* ─── Cart Actions ─────── */
  function addToCart(product: PublicCatalogItem, qty: number, notes: string) {
    if (!product.in_stock) return;
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id
          ? { ...i, quantity: i.quantity + qty, notes: notes || i.notes }
          : i);
      }
      return [...prev, { product, quantity: qty, notes }];
    });
    setSelectedProduct(null);
    setProductNotes('');
    setProductQty(1);
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(i => i.product.id === id
      ? { ...i, quantity: Math.max(1, i.quantity + delta) }
      : i
    ).filter(i => i.quantity > 0));
  }

  function removeItem(id: string) {
    setCart(prev => prev.filter(i => i.product.id !== id));
  }

  /* ─── WhatsApp Order ─────── */
  function handleCheckoutSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!customerName.trim()) return;

    const phone = config.whatsapp_phone || '';
    const lines = [
      `Nombre: ${customerName.trim()} | Delivery: ${deliveryMethod} | Pago: ${paymentMethod}`,
      '🛒 *Hola! Quiero hacer el siguiente pedido:*', 
      ''
    ];
    cart.forEach(item => {
      const price = item.product.is_special && item.product.special_price ? item.product.special_price : item.product.price;
      lines.push(`• *${item.product.name}* x${item.quantity} — ${fmt(price * item.quantity)}`);
      if (item.notes) lines.push(`  _Aclaraciones: ${item.notes}_`);
    });
    lines.push('');
    lines.push(`*Total: ${fmt(cartTotal)}*`);
    const text = encodeURIComponent(lines.join('\n'));
    setCheckoutOpen(false);
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, '_blank');
  }

  const accent = config.catalog_accent_color || '#e53935';
  const businessName = config.catalog_business_name || 'Nuestro Catálogo';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
          <p className="text-gray-500 font-medium">Cargando catálogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── HEADER BANNER ── */}
      <div className="relative w-full h-56 md:h-64 overflow-hidden" style={{ backgroundColor: accent }}>
        {config.catalog_banner_url && (
          <img src={config.catalog_banner_url} alt="banner" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
        <div className="relative z-10 h-full flex items-end px-4 pb-5 md:px-8">
          <div className="flex items-center gap-4">
            {config.catalog_logo_url ? (
              <img src={config.catalog_logo_url} alt="logo" className="w-20 h-20 rounded-full border-4 border-white shadow-lg object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg bg-white flex items-center justify-center" style={{ color: accent }}>
                <Store size={36} />
              </div>
            )}
            <div>
              <h1 className="text-white text-2xl md:text-3xl font-bold drop-shadow">{businessName}</h1>
              <p className="text-white/80 text-sm mt-0.5">Pedí fácil · Pagá al recibir</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── CATEGORY TABS ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center gap-2 px-4 overflow-x-auto py-2" ref={categoryBarRef}
          style={{ scrollbarWidth: 'none' }}>
          {/* Search inline */}
          <div className="relative shrink-0 mr-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 w-32 md:w-44"
              style={{ '--tw-ring-color': `${accent}66` } as any}
            />
          </div>
          <button
            onClick={() => { setActiveCategory(''); setSearch(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${!activeCategory && !search ? 'text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            style={!activeCategory && !search ? { backgroundColor: accent } : {}}
          >Inicio</button>
          {Object.keys(finalGrouped).map(cat => (
            <button
              key={cat}
              onClick={() => { 
                setActiveCategory(cat); 
                setSearch(''); 
                const el = document.getElementById(`category-${cat.replace(/\s+/g, '-')}`);
                if (el) {
                  const y = el.getBoundingClientRect().top + window.scrollY - 80;
                  window.scrollTo({ top: y, behavior: 'smooth' });
                }
              }}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeCategory === cat ? 'text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={activeCategory === cat ? { backgroundColor: accent } : {}}
            >{cat}</button>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-5xl mx-auto px-4 py-6 pb-28 md:pb-8">
        {Object.entries(finalGrouped).map(([cat, items]) => (
          <div key={cat} id={`category-${cat.replace(/\s+/g, '-')}`} className="mb-10 scroll-mt-24">
            {/* Category header */}
            {Object.keys(finalGrouped).length > 1 && (
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-gray-800">{cat}</h2>
                <span className="text-sm text-gray-400">{items.length} producto{items.length !== 1 ? 's' : ''}</span>
              </div>
            )}
            {/* Product list — one per row */}
            <div className="flex flex-col gap-3">
              {items.map(product => (
                <div
                  key={product.id}
                  onClick={() => {
                    if (!product.in_stock) return;
                    setSelectedProduct(product); setProductQty(1); setProductNotes('');
                  }}
                  className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex items-center gap-3 p-3 transition-all duration-200 ${product.in_stock ? 'cursor-pointer hover:shadow-md active:scale-[0.99]' : 'opacity-60'}`}
                >
                  {/* Thumbnail */}
                  <div className="relative shrink-0">
                    <ProductImage url1={product.image_url_1} url2={product.image_url_2} alt={product.name} className="w-20 h-20 rounded-xl" />
                    {!product.in_stock && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                        <span className="text-white text-[9px] font-bold uppercase tracking-wide">Agotado</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm leading-snug">{product.name}</p>
                      {product.is_special && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight border border-amber-200">
                          Especial
                        </span>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{product.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      {product.is_special && product.special_price ? (
                        <>
                          <p className="font-bold text-emerald-600 text-base">{fmt(product.special_price)}</p>
                          <p className="text-xs text-gray-400 line-through">{fmt(product.price)}</p>
                          {product.offer_label && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-extrabold shadow-sm animate-pulse border border-emerald-200">
                              {product.offer_label}
                            </span>
                          )}
                        </>
                      ) : (
                        <p className="font-bold text-gray-900 text-base">{fmt(product.price)}</p>
                      )}
                    </div>
                  </div>

                  {/* Add button */}
                  {product.in_stock ? (
                    <button
                      onClick={e => { e.stopPropagation(); addToCart(product, 1, ''); }}
                      className="shrink-0 w-10 h-10 rounded-full text-white flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-transform"
                      style={{ backgroundColor: accent }}
                    >
                      <Plus size={20} />
                    </button>
                  ) : (
                    <span className="shrink-0 text-xs font-semibold text-red-400 uppercase pr-1">Sin stock</span>
                  )}
                </div>
              ))}
            </div>

          </div>
        ))}

        {Object.keys(finalGrouped).length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Store size={48} className="mb-4 opacity-30" />
            <p className="text-lg font-medium">No se encontraron productos</p>
          </div>
        )}
      </div>

      {/* ── FLOATING CART BUTTON (mobile) ── */}
      {cartCount > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 md:hidden">
          <button
            onClick={() => setCartOpen(true)}
            className="flex items-center gap-3 px-6 py-3 rounded-full text-white shadow-2xl font-semibold"
            style={{ backgroundColor: accent }}
          >
            <ShoppingCart size={20} />
            <span>{cartCount} {cartCount === 1 ? 'producto' : 'productos'}</span>
            <span className="ml-1 font-bold">{fmt(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* ── CART BUTTON (desktop sidebar-ish) ── */}
      <div className="hidden md:flex fixed top-24 right-6 z-40 flex-col gap-2">
        <button
          onClick={() => setCartOpen(true)}
          className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-white shadow-xl font-semibold text-sm"
          style={{ backgroundColor: cartCount > 0 ? '#22c55e' : '#9ca3af' }}
        >
          <ShoppingCart size={18} />
          Mi cesta ({cartCount})
          {cartCount > 0 && <span className="ml-1 font-bold">{fmt(cartTotal)}</span>}
        </button>
      </div>

      {/* ── PRODUCT MODAL ── */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4" onClick={() => setSelectedProduct(null)}>
          <div
            className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-3xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Image */}
            <div className="relative">
              <ProductImage url1={selectedProduct.image_url_1} url2={selectedProduct.image_url_2} alt={selectedProduct.name} className="w-full h-56 md:h-64" />
              <button onClick={() => setSelectedProduct(null)}
                className="absolute top-3 right-3 bg-white/90 backdrop-blur rounded-full p-2 shadow-md hover:bg-white transition">
                <X size={18} />
              </button>
              {selectedProduct.category && (
                <span className="absolute top-3 left-3 bg-white/90 backdrop-blur text-xs font-semibold px-3 py-1 rounded-full" style={{ color: accent }}>
                  {selectedProduct.category}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="p-5">
              <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedProduct.name}</h3>
              {selectedProduct.description && (
                <p className="text-sm text-gray-500 mb-4">{selectedProduct.description}</p>
              )}

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Aclaraciones</label>
                <textarea
                  value={productNotes}
                  onChange={e => setProductNotes(e.target.value)}
                  placeholder="¿Algo que comentar? Dinos aquí"
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 resize-none"
                  style={{ '--tw-ring-color': `${accent}44` } as any}
                />
              </div>

              {/* Qty + Subtotal */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3 bg-gray-100 rounded-xl p-1">
                  <button onClick={() => setProductQty(q => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-gray-50">
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center font-bold text-sm">{productQty}</span>
                  <button onClick={() => setProductQty(q => q + 1)}
                    className="w-8 h-8 rounded-lg text-white shadow-sm flex items-center justify-center"
                    style={{ backgroundColor: accent }}>
                    <Plus size={14} />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Subtotal</p>
                  <p className="text-lg font-bold text-gray-900">
                    {fmt((selectedProduct.is_special && selectedProduct.special_price ? selectedProduct.special_price : selectedProduct.price) * productQty)}
                  </p>
                </div>
              </div>

              {/* Add button */}
              <button
                onClick={() => addToCart(selectedProduct, productQty, productNotes)}
                className="w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-md hover:opacity-90 transition"
                style={{ backgroundColor: accent }}
              >
                Añadir al pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CART PANEL ── */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:justify-end bg-black/50" onClick={() => setCartOpen(false)}>
          <div
            className="bg-white w-full md:w-96 md:h-full h-[85vh] md:rounded-none rounded-t-3xl overflow-hidden flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Cart header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShoppingCart size={22} style={{ color: accent }} />
                <h2 className="text-lg font-bold text-gray-900">Mi cesta</h2>
                {cartCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full text-white font-semibold" style={{ backgroundColor: accent }}>
                    {cartCount}
                  </span>
                )}
              </div>
              <button onClick={() => setCartOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                  <ShoppingCart size={48} className="opacity-20" />
                  <p className="font-medium">La cesta está vacía</p>
                  <p className="text-sm text-center">Agregá productos desde el catálogo</p>
                </div>
              ) : cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-200">
                    {item.product.image_url_1
                      ? <img src={item.product.image_url_1} alt={item.product.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Store size={20} className="text-gray-300" /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{item.product.name}</p>
                    {item.notes && <p className="text-xs text-gray-400 truncate italic">{item.notes}</p>}
                    <p className="text-sm font-bold mt-0.5" style={{ color: accent }}>
                      {fmt((item.product.is_special && item.product.special_price ? item.product.special_price : item.product.price) * item.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-0.5">
                      <button onClick={() => { if (item.quantity === 1) removeItem(item.product.id); else updateQty(item.product.id, -1); }}
                        className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded-md text-gray-600">
                        {item.quantity === 1 ? <X size={12} /> : <Minus size={12} />}
                      </button>
                      <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product.id, 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-white"
                        style={{ backgroundColor: accent }}>
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart footer */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-gray-100 space-y-3 bg-white">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total</span>
                  <span className="text-2xl font-extrabold text-gray-900">{fmt(cartTotal)}</span>
                </div>
                <button
                  onClick={() => setCheckoutOpen(true)}
                  className="w-full py-4 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition"
                  style={{ backgroundColor: '#25D366' }}
                >
                  <MessageCircle size={22} />
                  Continuar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── CHECKOUT MODAL ── */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4" onClick={() => setCheckoutOpen(false)}>
          <form 
            onSubmit={handleCheckoutSubmit}
            className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: '90vh' }}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Finalizar Pedido</h2>
              <button type="button" onClick={() => setCheckoutOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tu Nombre o Alias</label>
                <input 
                  type="text" 
                  required
                  autoFocus
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Ej: Lucas"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': `${accent}66` } as any}
                />
              </div>

              {/* Delivery Method */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">¿Cómo preferís recibirlo?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setDeliveryMethod('Delivery')}
                    className={`py-3 px-4 rounded-xl border-2 font-medium text-sm transition-all ${deliveryMethod === 'Delivery' ? 'border-transparent text-white shadow-md' : 'border-gray-100 text-gray-600 bg-white hover:border-gray-200'}`}
                    style={deliveryMethod === 'Delivery' ? { backgroundColor: accent } : {}}
                  >
                    Delivery
                  </button>
                  <button type="button" onClick={() => setDeliveryMethod('Retiro en local')}
                    className={`py-3 px-4 rounded-xl border-2 font-medium text-sm transition-all ${deliveryMethod === 'Retiro en local' ? 'border-transparent text-white shadow-md' : 'border-gray-100 text-gray-600 bg-white hover:border-gray-200'}`}
                    style={deliveryMethod === 'Retiro en local' ? { backgroundColor: accent } : {}}
                  >
                    Retiro en Local
                  </button>
                </div>
                {deliveryMethod === 'Delivery' && (
                  <p className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                    💡 <span className="font-medium text-gray-700">El cadete te pedirá tu ubicación GPS de WhatsApp</span> por privado para cotizar el envío exacto a tu puerta.
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Método de Pago</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setPaymentMethod('Efectivo')}
                    className={`py-3 px-4 rounded-xl border-2 font-medium text-sm transition-all ${paymentMethod === 'Efectivo' ? 'border-transparent text-white shadow-md' : 'border-gray-100 text-gray-600 bg-white hover:border-gray-200'}`}
                    style={paymentMethod === 'Efectivo' ? { backgroundColor: accent } : {}}
                  >
                    Efectivo
                  </button>
                  <button type="button" onClick={() => setPaymentMethod('Transferencia / MP')}
                    className={`py-3 px-4 rounded-xl border-2 font-medium text-sm transition-all ${paymentMethod === 'Transferencia / MP' ? 'border-transparent text-white shadow-md' : 'border-gray-100 text-gray-600 bg-white hover:border-gray-200'}`}
                    style={paymentMethod === 'Transferencia / MP' ? { backgroundColor: accent } : {}}
                  >
                    Transf. / MP
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 mt-auto">
              <button
                type="submit"
                className="w-full py-4 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition"
                style={{ backgroundColor: '#25D366' }}
              >
                <MessageCircle size={22} />
                Enviar a WhatsApp
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
