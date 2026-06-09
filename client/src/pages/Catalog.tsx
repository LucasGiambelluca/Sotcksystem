import { useEffect, useState, useRef } from 'react';
import { ShoppingCart, X, Plus, Minus, ChevronLeft, ChevronRight, ChevronDown, MessageCircle, Search, Store, Clock, Truck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { catalogPromotionService } from '../services/productService';
import type { PublicCatalogItem, CatalogPromotion } from '../types';
import { PromotionSlider } from '../components/catalog/PromotionSlider';
import { CatalogLoader } from '../components/catalog/CatalogLoader';
import { WORLD_CUP_2026, WC_COLORS } from '../config/worldCup';
import systemLogo from '../assets/nuevologo.png';

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
  catalog_worldcup_skin?: boolean;
  catalog_loader_video?: boolean;
}

/* ─── Helpers ────────────────────────────────────────────────── */
const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;

/* ─── Branding cache (so repeat visitors see the local logo instantly) ─── */
const BRANDING_CACHE_KEY = 'catalog_branding';

function readBrandingCache(): BusinessConfig {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY);
    return raw ? (JSON.parse(raw) as BusinessConfig) : {};
  } catch {
    return {};
  }
}

function writeBrandingCache(cfg: BusinessConfig) {
  try {
    localStorage.setItem(
      BRANDING_CACHE_KEY,
      JSON.stringify({
        catalog_logo_url: cfg.catalog_logo_url,
        catalog_accent_color: cfg.catalog_accent_color,
        catalog_business_name: cfg.catalog_business_name,
        catalog_worldcup_skin: cfg.catalog_worldcup_skin,
        catalog_loader_video: cfg.catalog_loader_video,
      })
    );
  } catch {
    /* private mode / storage disabled — ignore */
  }
}

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
  const [config, setConfig] = useState<BusinessConfig>(() => readBrandingCache());
  const [promotions, setPromotions] = useState<CatalogPromotion[]>([]);
  const [phase, setPhase] = useState<'loading' | 'exiting' | 'ready'>('loading');
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PublicCatalogItem | null>(null);
  const [productNotes, setProductNotes] = useState('');
  const [productQty, setProductQty] = useState(1);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  
  // Checkout Modal States
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('Delivery');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Transf / MP' | 'Débito'>('Efectivo');
  const [shippingFee, setShippingFee] = useState<number | null>(null);
  const [distanceInfo, setDistanceInfo] = useState<{ blocks: number | null, error?: string } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');

  // 1. Auto-fill from URL Parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get('name');
    const phone = params.get('phone');
    const addr = params.get('address');
    const method = params.get('delivery_method');

    if (name) setCustomerName(name);
    if (phone) setPhoneNumber(phone);
    
    if (method === 'pickup' || method === 'PICKUP' || method === 'Retiro en local') {
        setDeliveryMethod('Retiro en local');
        setAddress(''); // Ensure address is clear if pickup is forced
    } else if (addr) {
        setAddress(addr);
        setDeliveryMethod('Delivery');
    }
  }, []);

  // 2. Auto-calculate shipping fee when address changes
  useEffect(() => {
    if (deliveryMethod !== 'Delivery' || !address || address.length < 5) {
      setShippingFee(null);
      setDistanceInfo(null);
      setLocationError(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${API_BASE}/api/public/orders/calculate-shipping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address })
        });
        const data = await res.json();
        if (data.success) {
          setShippingFee(data.fee);
          setDistanceInfo({ blocks: data.blocks });
          setLocationError(null);
        } else {
          setShippingFee(null);
          setDistanceInfo({ blocks: null, error: data.error });
          setLocationError(data.error || 'Fuera de zona de entrega');
        }
      } catch (e) {
        console.error('Error calculating shipping:', e);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [address, deliveryMethod]);
  const categoryBarRef = useRef<HTMLDivElement>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the World Cup loader on screen long enough to show the 7s video clip,
  // even when the data finishes loading first.
  const loaderStartRef = useRef(Date.now());

  useEffect(() => {
    loadData();
    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, []);

  async function loadData() {
    // Default to honoring the loader video (cached value if we have one) until
    // the live branding row tells us otherwise.
    let videoEnabled = WORLD_CUP_2026 && config.catalog_loader_video !== false;
    try {
      // Phase 1: branding first — gives us the local logo before products load.
      const { data: cfg } = await supabase.from('public_branding').select('*').maybeSingle();
      if (cfg) {
        const c = cfg as BusinessConfig;
        videoEnabled = WORLD_CUP_2026 && c.catalog_loader_video !== false;
        setConfig(c);
        writeBrandingCache(c);
      }

      // Phase 2: products + promos (the slow queries).
      const [{ data: prods }, promos] = await Promise.all([
        supabase.from('public_catalog').select('*').order('name', { ascending: true }),
        catalogPromotionService.getAll(true).catch(() => [] as CatalogPromotion[]),
      ]);
      if (prods) setProducts(prods as PublicCatalogItem[]);
      setPromotions((promos ?? []) as CatalogPromotion[]);
    } finally {
      // Phase 3: always reveal — even on error — so the full-screen loader never
      // sticks (this project's Supabase can be paused / unreachable). When the
      // loader video plays, hold until the 5s clip finishes; otherwise reveal now.
      const CLIP_MS = videoEnabled ? 5000 : 0;
      const elapsed = Date.now() - loaderStartRef.current;
      const wait = Math.max(0, CLIP_MS - elapsed);
      phaseTimerRef.current = setTimeout(() => {
        setPhase('exiting');
        phaseTimerRef.current = setTimeout(() => setPhase('ready'), 600); // matches .animate-fade-out-screen (0.6s)
      }, wait);
    }
  }

  /* ─── Promo CTA handler: scroll to & open product ─── */
  function handlePromoOrder(productId: string) {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      setProductQty(1);
      setProductNotes('');
    }
  }

  /* ─── Derived State ─────── */
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));

  const categoriesInOrder: string[] = [];
  const grouped: Record<string, PublicCatalogItem[]> = {};
  
  const specials = filtered.filter(p => p.is_special);
  if (specials.length > 0) {
    categoriesInOrder.push('⭐ Especiales');
    grouped['⭐ Especiales'] = specials;
  }

  filtered.forEach(p => {
    if (p.is_special) return;
    const cat = p.category || 'General';
    if (!grouped[cat]) {
      grouped[cat] = [];
      categoriesInOrder.push(cat);
    }
    grouped[cat].push(p);
  });

  const finalGrouped = grouped;
  const categories = categoriesInOrder;

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
  async function handleCheckoutSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!customerName.trim()) return;

    if (deliveryMethod === 'Delivery' && (shippingFee === null || locationError)) {
      alert(locationError || 'Lo sentimos, esa dirección está fuera de nuestra zona de entrega.');
      return;
    }

    triggerWhatsAppFallback();
  }

  function triggerWhatsAppFallback() {
    const rawPhone = config.whatsapp_phone || '5492915091234';
    const phone = rawPhone.replace(/\D/g, '');
    const lines = [
      `*${customerName.trim()}* | _${deliveryMethod}_${deliveryMethod === 'Delivery' ? ` | Dir: ${address.trim()}` : ''} | $: ${paymentMethod}`,
      '🛒 *Hola! Quiero hacer el siguiente pedido:*', 
      ''
    ];
    cart.forEach(item => {
      lines.push(`• ${item.product.name} x${item.quantity}`);
      if (item.notes) lines.push(`  _Notas: ${item.notes}_`);
    });
    lines.push('');
    
    if (deliveryMethod === 'Delivery' && shippingFee !== null) {
      lines.push(`🛵 *Envío: ${fmt(shippingFee)}*`);
    }
    
    lines.push(`💰 *Total: ${fmt(cartTotal + (shippingFee || 0))}*`);
    const text = encodeURIComponent(lines.join('\n'));
    
    const waUrl = phone 
      ? `https://api.whatsapp.com/send/?phone=${phone}&text=${text}`
      : `https://api.whatsapp.com/send/?text=${text}`;
    window.open(waUrl, '_blank');
    setCheckoutOpen(false);
  }

  const accent = config.catalog_accent_color || '#e53935';
  const businessName = config.catalog_business_name || 'Nuestro Catálogo';

  // Master build flag AND per-business toggles (default on when column is null).
  const skinOn = WORLD_CUP_2026 && config.catalog_worldcup_skin !== false;
  const videoOn = WORLD_CUP_2026 && config.catalog_loader_video !== false;
  /* ─── Helpers for PedidosYa layout ─── */
  function discountPct(product: PublicCatalogItem): number | null {
    if (!product.is_special || !product.special_price || product.special_price >= product.price) return null;
    return Math.round(((product.price - product.special_price) / product.price) * 100);
  }
  /** Pick a representative thumbnail for a category (first product with image). */
  function categoryThumb(cat: string): string | null {
    const items = finalGrouped[cat];
    if (!items) return null;
    const withImg = items.find(p => p.image_url_1);
    return withImg?.image_url_1 || null;
  }

  return (
    <>
      {phase !== 'ready' && (
        <CatalogLoader
          logoUrl={config.catalog_logo_url}
          accentColor={accent}
          businessName={businessName}
          videoEnabled={videoOn}
          exiting={phase === 'exiting'}
        />
      )}

      {phase !== 'loading' && (
        <>
        <div className={`min-h-screen bg-gray-50 animate-content-reveal ${skinOn ? 'wc-bg' : ''}`}>
      {/* ── HEADER (PedidosYa style: cover + overlapping card) ── */}
      <div className="relative w-full h-40 md:h-52 overflow-hidden" style={{ backgroundColor: accent }}>
        {config.catalog_banner_url && (
          <img src={config.catalog_banner_url} alt="banner" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/50 pointer-events-none" />
        {skinOn && (
          <div
            className="absolute top-0 left-0 right-0 h-1.5 z-20 pointer-events-none"
            style={{ background: `linear-gradient(90deg, ${WC_COLORS.join(', ')})` }}
          />
        )}
        {/* Search bar overlay */}
        <div className="absolute top-3 left-0 right-0 z-20 px-4 flex items-center gap-3 max-w-5xl mx-auto">
          <button onClick={() => window.history.back()} className="w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-md">
            <ChevronLeft size={18} className="text-gray-700" />
          </button>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Buscar en ${businessName}...`}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/95 backdrop-blur border-0 rounded-full shadow-md focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': `${accent}66` } as any}
            />
          </div>
        </div>
      </div>

      {/* ── BUSINESS CARD (overlapping the banner like PedidosYa) ── */}
      <div className="max-w-5xl mx-auto px-4 -mt-14 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-5 border border-gray-100">
          <div className="flex items-center gap-4">
            {config.catalog_logo_url ? (
              <img src={config.catalog_logo_url} alt="logo" className="w-16 h-16 md:w-20 md:h-20 rounded-2xl border-2 border-gray-100 shadow-sm object-cover" />
            ) : (
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl border-2 border-gray-100 shadow-sm bg-gray-50 flex items-center justify-center" style={{ color: accent }}>
                <Store size={32} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-extrabold text-gray-900 truncate">{businessName}</h1>
              {skinOn && (
                <p className="text-xs font-bold mt-0.5" style={{ color: WC_COLORS[0] }}>
                  ⚽ Edición Mundial 2026
                </p>
              )}
            </div>
          </div>

          {/* Trust bar (PedidosYa-style pills) */}
          <div className="catalog-trust-bar mt-3">
            <div className="catalog-trust-pill bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Clock size={13} /> Pedí fácil
            </div>
            <div className="catalog-trust-pill bg-blue-50 text-blue-700 border border-blue-100">
              <Truck size={13} /> Delivery & Retiro
            </div>
            <div className="catalog-trust-pill bg-amber-50 text-amber-700 border border-amber-100">
              💳 Pagá al recibir
            </div>
            {skinOn && (
              <div className="catalog-trust-pill text-white border-0" style={{ background: `linear-gradient(90deg, ${WC_COLORS[0]}, ${WC_COLORS[3]})` }}>
                🏆 ¡Vamos Argentina!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── WORLD CUP 2026 BUNTING ── */}
      {skinOn && (
        <div className="wc-bunting mt-4" aria-hidden="true">
          {Array.from({ length: 60 }).map((_, i) => (
            <span key={i} style={{ borderTopColor: WC_COLORS[i % WC_COLORS.length] }} />
          ))}
        </div>
      )}

      {/* ── CATEGORY GRID (visual shortcuts like PedidosYa) ── */}
      {categories.length > 1 && !search && (
        <div className="max-w-5xl mx-auto px-4 mt-5">
          <div className="catalog-section-head">
            <h2>Categorías</h2>
          </div>
          <div className="catalog-hscroll pb-2">
            {categories.map(cat => {
              const thumb = categoryThumb(cat);
              return (
                <div
                  key={cat}
                  className="catalog-cat-item"
                  onClick={() => {
                    setActiveCategory(cat);
                    setSearch('');
                    const el = document.getElementById(`category-${cat.replace(/\s+/g, '-')}`);
                    if (el) {
                      const y = el.getBoundingClientRect().top + window.scrollY - 60;
                      window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                  }}
                >
                  <div className="catalog-cat-thumb">
                    {thumb ? (
                      <img src={thumb} alt={cat} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-gray-700 text-center leading-tight max-w-[80px] line-clamp-2">{cat}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STICKY CATEGORY TABS ── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center gap-2 px-4 overflow-x-auto py-2" ref={categoryBarRef}
          style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => { setActiveCategory(''); setSearch(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${!activeCategory && !search ? 'text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            style={!activeCategory && !search ? { backgroundColor: accent } : {}}
          >Inicio</button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setSearch('');
                const el = document.getElementById(`category-${cat.replace(/\s+/g, '-')}`);
                if (el) {
                  const y = el.getBoundingClientRect().top + window.scrollY - 60;
                  window.scrollTo({ top: y, behavior: 'smooth' });
                }
              }}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${activeCategory === cat ? 'text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={activeCategory === cat ? { backgroundColor: accent } : {}}
            >{cat}</button>
          ))}
        </div>
      </div>

      {/* ── PROMOTION SLIDER ── */}
      {promotions.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 pt-5">
          <PromotionSlider
            promotions={promotions}
            onOrder={handlePromoOrder}
            accentColor={accent}
            interval={5000}
          />
        </div>
      )}



      {/* ── MAIN CONTENT ── */}
      <div className="max-w-5xl mx-auto px-4 py-5 pb-28 md:pb-8">

        {/* ── SPECIALS: Horizontal carousel (PedidosYa style) ── */}
        {specials.length > 0 && (
          <div className={`mb-8 scroll-mt-20 ${skinOn ? 'wc-section-box' : 'bg-emerald-50 rounded-2xl p-4 border border-emerald-100'}`} id="category-⭐-Especiales">
            <div className="catalog-section-head">
              <h2 style={skinOn ? { color: WC_COLORS[0] } : { color: '#059669' }}>
                {skinOn ? '⚽ Especiales del Mundial' : '⭐ Especiales'}
              </h2>
              <span className="text-xs font-semibold text-gray-400">{specials.length} productos</span>
            </div>
            <div className="catalog-hscroll">
              {specials.map(product => {
                const pct = discountPct(product);
                return (
                  <div
                    key={product.id}
                    className="catalog-vcard"
                    onClick={() => { if (product.in_stock) { setSelectedProduct(product); setProductQty(1); setProductNotes(''); } }}
                  >
                    {/* Image area */}
                    <div className="relative aspect-square bg-gray-100">
                      {product.image_url_1 ? (
                        <img src={product.image_url_1} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Store size={28} className="text-gray-300" /></div>
                      )}
                      {pct && <span className="catalog-badge-off">{pct}% OFF</span>}
                      {!product.in_stock && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-white text-[10px] font-bold uppercase">Agotado</span>
                        </div>
                      )}
                      {product.in_stock && (
                        <button
                          className="catalog-vcard-add"
                          onClick={e => { e.stopPropagation(); addToCart(product, 1, ''); }}
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-3">
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{product.name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="font-extrabold text-base" style={{ color: accent }}>
                          {fmt(product.special_price || product.price)}
                        </span>
                        {product.special_price && product.special_price < product.price && (
                          <span className="text-xs text-gray-400 line-through">{fmt(product.price)}</span>
                        )}
                      </div>
                      {product.offer_label && (
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                          {product.offer_label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── REGULAR CATEGORIES: Collapsible sections with celeste background ── */}
        {categories.filter(c => c !== '⭐ Especiales').map((cat, catIdx) => {
          const items = finalGrouped[cat];
          const PREVIEW = 4;
          const isExpanded = !!expandedCats[cat];
          const visible = isExpanded ? items : items.slice(0, PREVIEW);
          const hasMore = items.length > PREVIEW;
          // Alternate celeste tones for visual variety
          const sectionBg = skinOn
            ? catIdx % 2 === 0
              ? 'bg-gradient-to-br from-sky-50/80 to-blue-50/60 border border-sky-100/60'
              : 'bg-gradient-to-br from-slate-50/80 to-sky-50/40 border border-slate-100/50'
            : catIdx % 2 === 0
              ? 'bg-gray-50/80 border border-gray-100/60'
              : 'bg-white border border-gray-100/40';
          return (
          <div key={cat} id={`category-${cat.replace(/\s+/g, '-')}`} className={`mb-6 scroll-mt-20 rounded-2xl p-4 ${sectionBg}`}>
            {/* Section header */}
            <div className="catalog-section-head">
              <h2>{cat}</h2>
              <span className="text-xs font-semibold text-gray-400">{items.length} producto{items.length !== 1 ? 's' : ''}</span>
            </div>
            {/* Product rows */}
            <div className="flex flex-col gap-3">
              {visible.map(product => {
                const pct = discountPct(product);
                return (
                <div
                  key={product.id}
                  onClick={() => {
                    if (!product.in_stock) return;
                    setSelectedProduct(product); setProductQty(1); setProductNotes('');
                  }}
                  className={`catalog-row-card ${!product.in_stock ? 'opacity-50' : ''}`}
                >
                  {/* Bigger thumbnail with discount badge */}
                  <div className="relative shrink-0">
                    <ProductImage url1={product.image_url_1} url2={product.image_url_2} alt={product.name} className="w-24 h-24 rounded-2xl" />
                    {pct && <span className="catalog-badge-off">{pct}% OFF</span>}
                    {!product.in_stock && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
                        <span className="text-white text-[9px] font-bold uppercase tracking-wide">Agotado</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-[15px] leading-snug line-clamp-2">{product.name}</p>
                    {product.description && (
                      <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{product.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {product.is_special && product.special_price ? (
                        <>
                          <p className="font-extrabold text-base" style={{ color: accent }}>{fmt(product.special_price)}</p>
                          <p className="text-xs text-gray-400 line-through">{fmt(product.price)}</p>
                        </>
                      ) : (
                        <p className="font-extrabold text-gray-900 text-base">{fmt(product.price)}</p>
                      )}
                      {product.offer_label && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-extrabold border border-emerald-200">
                          {product.offer_label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Add button */}
                  {product.in_stock ? (
                    <button
                      onClick={e => { e.stopPropagation(); addToCart(product, 1, ''); }}
                      className="shrink-0 w-10 h-10 rounded-full bg-white border-2 flex items-center justify-center shadow-sm hover:scale-110 active:scale-95 transition-transform"
                      style={{ borderColor: accent, color: accent }}
                    >
                      <Plus size={18} strokeWidth={2.5} />
                    </button>
                  ) : (
                    <span className="shrink-0 text-xs font-semibold text-red-400 uppercase pr-1">Sin stock</span>
                  )}
                </div>
              );
              })}
            </div>
            {/* Ver más / Ver menos */}
            {hasMore && (
              <button
                onClick={() => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
                className="w-full mt-3 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all hover:opacity-80 active:scale-[0.98]"
                style={skinOn
                  ? { background: 'linear-gradient(90deg, #74acdf22, #f6b40e22)', color: '#2563eb', border: '1px solid #74acdf44' }
                  : { background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }
                }
              >
                <ChevronDown size={16} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                {isExpanded ? 'Ver menos' : `Ver todos (${items.length})`}
              </button>
            )}
          </div>
        );
        })}

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

      {/* ── FOOTER ── */}
      <footer className="py-16 bg-white border-t border-gray-100 flex flex-col items-center justify-center opacity-60 hover:opacity-100 transition-opacity">
        <div className="flex flex-col items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Power by</span>
          <img src={systemLogo} alt="StockSystem Logo" className="h-20 w-auto" />
        </div>
      </footer>
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
            {/* Total Summary */}
            <div className="bg-gray-50 p-6 -mx-6 mb-6">
              <div className="flex justify-between items-center text-sm text-gray-500 mb-2">
                <span>Subtotal</span>
                <span>${cartTotal.toLocaleString('es-AR')}</span>
              </div>
              
              {deliveryMethod === 'Delivery' && (
                <div className="flex justify-between items-center text-sm mb-4">
                  <div className="flex flex-col">
                    <span className="text-gray-500">Envío {distanceInfo?.blocks ? `(~${distanceInfo.blocks} cuadras)` : ''}</span>
                    {distanceInfo?.error && <span className="text-red-500 text-[10px] font-bold">{distanceInfo.error}</span>}
                  </div>
                  <span className={shippingFee !== null ? 'text-gray-900 font-medium' : 'text-gray-300 italic'}>
                    {shippingFee !== null ? `+$${shippingFee.toLocaleString('es-AR')}` : (address.length >= 5 ? 'Calculando...' : 'Ingresá dirección')}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-2xl font-black text-gray-900" style={{ color: accent }}>
                  ${(cartTotal + (shippingFee || 0)).toLocaleString('es-AR')}
                </span>
              </div>
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t border-gray-100 space-y-3 bg-white">
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

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tu WhatsApp (con código de área)</label>
                <input 
                  type="tel" 
                  required
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="Ej: 2915091234"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': `${accent}66` } as any}
                />
                <p className="mt-1 text-[10px] text-gray-500 italic">Te enviaremos novedades de tu pedido por aquí.</p>
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
                  <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Dirección de Entrega</label>
                    <input 
                      type="text" 
                      required
                      value={address}
                      onChange={e => { setAddress(e.target.value); setLocationError(null); }}
                      placeholder="Calle, número y localidad"
                      className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${locationError ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                      style={{ '--tw-ring-color': `${accent}66` } as any}
                    />
                    {locationError && (
                      <p className="mt-1.5 text-xs text-red-600 font-bold flex items-center gap-1.5 animate-bounce">
                        ⚠️ {locationError}
                      </p>
                    )}
                    <p className="mt-2 text-[10px] text-gray-500 bg-blue-50 p-2 rounded-lg border border-blue-100 leading-tight">
                      ℹ️ <span className="font-medium text-gray-700">Opcional:</span> El cadete también podría pedirte tu ubicación GPS de WhatsApp para mayor precisión.
                    </p>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Método de Pago</label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setPaymentMethod('Efectivo')}
                    className={`py-3 px-2 rounded-xl border-2 font-medium text-xs transition-all ${paymentMethod === 'Efectivo' ? 'border-transparent text-white shadow-md' : 'border-gray-100 text-gray-600 bg-white hover:border-gray-200'}`}
                    style={paymentMethod === 'Efectivo' ? { backgroundColor: accent } : {}}
                  >
                    Efectivo
                  </button>
                  <button type="button" onClick={() => setPaymentMethod('Transf / MP')}
                    className={`py-3 px-2 rounded-xl border-2 font-medium text-xs transition-all ${paymentMethod === 'Transf / MP' ? 'border-transparent text-white shadow-md' : 'border-gray-100 text-gray-600 bg-white hover:border-gray-200'}`}
                    style={paymentMethod === 'Transf / MP' ? { backgroundColor: accent } : {}}
                  >
                    Transf. / MP
                  </button>
                  <button type="button" onClick={() => setPaymentMethod('Débito')}
                    className={`py-3 px-2 rounded-xl border-2 font-medium text-xs transition-all ${paymentMethod === 'Débito' ? 'border-transparent text-white shadow-md' : 'border-gray-100 text-gray-600 bg-white hover:border-gray-200'}`}
                    style={paymentMethod === 'Débito' ? { backgroundColor: accent } : {}}
                  >
                    Débito
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 mt-auto">
                <button
                type="submit"
                className={`w-full py-4 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition`}
                style={{ backgroundColor: '#25D366' }}
              >
                  <MessageCircle size={22} />
                Enviar a WhatsApp
              </button>
            </div>
          </form>
        </div>
      )}
    </>
      )}
    </>
  );
}
