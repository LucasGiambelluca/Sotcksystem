import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { createOrder } from '../services/orderService';
import { toast } from 'sonner';
import { 
  ShoppingCart, Search, Plus, Minus, X, Check, 
  Package, DollarSign, Store,
  UtensilsCrossed, Coffee, Pizza, Beef, Sandwich, IceCream
} from 'lucide-react';
import type { CatalogItem } from '../types';
import NewOrderAlertModal from '../components/NewOrderAlertModal';

const CATEGORY_ICONS: Record<string, any> = {
  'Pizzas': <Pizza size={20} />,
  'Hamburguesas': <Beef size={20} />,
  'Sándwiches': <Sandwich size={20} />,
  'Bebidas': <Coffee size={20} />,
  'Postres': <IceCream size={20} />,
  'default': <UtensilsCrossed size={20} />
};

export default function TabletOrdering() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Cart State
  const [cart, setCart] = useState<any[]>([]);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('name');
    
    if (data) {
      setItems(data);
      const cats = Array.from(new Set(data.map(i => i.category))).sort();
      setCategories(['Todos', ...cats]);
    }
    setLoading(false);
  }

  const filteredItems = items.filter(i => {
    const matchesCat = activeCategory === 'Todos' || i.category === activeCategory;
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const addToCart = (product: CatalogItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(0, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }).filter(i => i.quantity > 0));
  };

  const handleConfirmOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cart.length === 0) return toast.error('El carrito está vacío');
    if (!customerName.trim()) return toast.error('Ingresá el nombre del cliente');

    setIsCreatingOrder(true);
    try {
      // 1. Find or Create Client
      let clientId = '';
      const cleanPhone = customerPhone.replace(/\D/g, '');
      
      if (cleanPhone) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('phone', cleanPhone)
          .maybeSingle();
        
        if (existing) {
          clientId = existing.id;
        } else {
          const { data: nw, error: nwe } = await supabase
            .from('clients')
            .insert({ name: customerName.trim(), phone: cleanPhone })
            .select()
            .single();
          if (nwe) throw nwe;
          clientId = nw.id;
        }
      } else {
        // Simple counter sale without phone? We need a client_id anyway.
        // We'll search for "Venta Mostrador" or create it.
        const { data: mostrador } = await supabase
          .from('clients')
          .select('id')
          .ilike('name', 'Venta Mostrador')
          .maybeSingle();
        
        if (mostrador) {
          clientId = mostrador.id;
        } else {
          const { data: nw } = await supabase
            .from('clients')
            .insert({ name: 'Venta Mostrador' })
            .select()
            .single();
          clientId = nw?.id || '';
        }
      }

      if (!clientId) throw new Error('No se pudo determinar el cliente');

      const orderData = {
        client_id: clientId,
        channel: 'TABLET' as any,
        status: 'PENDING',
        notes: cleanPhone ? `Nombre: ${customerName.trim()}` : `Cliente: ${customerName.trim()}`,
        items: cart.map(i => ({
          catalog_item_id: i.id,
          quantity: i.quantity,
          unit_price: i.price
        }))
      };

      const { error } = await createOrder(orderData);
      if (error) throw error;

      toast.success('Pedido enviado a la cocina ✅');
      setCart([]);
      setSearch('');
      setIsCheckoutModalOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setShowSuccess(true);
    } catch (err: any) {
      toast.error('Error al crear pedido: ' + err.message);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Cargando menú...</div>;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden text-gray-800">
      {/* ── LEFT SIDEBAR: CATEGORIES ── */}
      <div className="w-20 md:w-32 bg-white border-r flex flex-col items-center py-6 gap-4 shadow-sm z-10">
        <div className="mb-8 p-2 bg-blue-50 rounded-xl">
          <UtensilsCrossed size={32} className="text-blue-600" />
        </div>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex flex-col items-center justify-center w-16 h-16 md:w-24 md:h-20 rounded-2xl transition-all ${
              activeCategory === cat 
                ? 'bg-blue-600 text-white shadow-lg scale-110' 
                : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            {CATEGORY_ICONS[cat] || CATEGORY_ICONS.default}
            <span className="text-[10px] md:text-xs font-bold mt-1 uppercase truncate w-full text-center px-1">{cat}</span>
          </button>
        ))}
      </div>

      {/* ── CENTRAL AREA: PRODUCTS ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white p-4 border-b flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="hidden md:flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border">
            <Store size={18} className="text-gray-400" />
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase">Terminal</p>
              <p className="text-sm font-bold text-blue-600">Mostrador / Tablet</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
          {filteredItems.map(item => (
            <div
              key={item.id}
              onClick={() => addToCart(item)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-200 cursor-pointer transition-all active:scale-95 flex flex-col relative group overflow-hidden"
            >
              {item.image_url_1 ? (
                <div className="h-32 mb-3 rounded-xl overflow-hidden">
                  <img src={item.image_url_1} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
              ) : (
                <div className="h-32 mb-3 rounded-xl bg-gray-50 flex items-center justify-center">
                  <Store className="text-gray-200" size={40} />
                </div>
              )}
              <h3 className="font-bold text-gray-900 leading-tight mb-1">{item.name}</h3>
              <p className="text-xs text-gray-400 line-clamp-2 flex-1 mb-2">{item.description}</p>
              <div className="flex items-center justify-between mt-auto">
                <span className="font-black text-blue-600 text-lg">${item.price}</span>
                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus size={16} />
                </div>
              </div>
            </div>
          ))}
        </main>
      </div>

      {/* ── RIGHT SIDEBAR: CART ── */}
      <div className="w-72 md:w-96 bg-white border-l shadow-2xl flex flex-col z-20">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">PEDIDO</h2>
            <p className="text-xs font-bold text-gray-400 uppercase">Resumen de Comanda</p>
          </div>
          <div className="bg-blue-100 text-blue-600 p-3 rounded-2xl">
            <ShoppingCart size={24} />
          </div>
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4 opacity-50">
              <Package size={64} />
              <p className="font-bold text-center">EL PEDIDO ESTÁ VACÍO</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex flex-col gap-2 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-gray-900 leading-tight flex-1">{item.name}</span>
                  <span className="font-black text-blue-600 ml-2">${item.price * item.quantity}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                    <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white shadow-sm rounded-lg hover:bg-gray-50 transition-colors">
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center font-black text-sm">{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, +1)} className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white shadow-sm rounded-lg hover:bg-blue-700 transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>
                  <button onClick={() => updateQty(item.id, -item.quantity)} className="text-gray-300 hover:text-red-400 p-2">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-gray-900 text-white rounded-t-[32px] shadow-2xl space-y-4">
          <div className="flex justify-between items-center px-2">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total comanda</p>
              <p className="text-3xl font-black text-white">${cartTotal.toLocaleString('es-AR')}</p>
            </div>
            <div className="bg-white/10 p-3 rounded-2xl">
              <DollarSign className="text-emerald-400" size={32} />
            </div>
          </div>
          
          <button
            onClick={() => setIsCheckoutModalOpen(true)}
            disabled={isCreatingOrder || cart.length === 0}
            className="w-full py-5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-2xl font-black text-lg transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3"
          >
            <Check size={24} />
            ENVIAR A COCINA
          </button>
        </div>
      </div>

      {/* ── CHECKOUT MODAL ── */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsCheckoutModalOpen(false)}>
          {/* ... Modal content ... */}
          <form 
            onSubmit={handleConfirmOrder}
            className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-8 pb-4 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">DATOS DEL CLIENTE</h2>
                <p className="text-xs font-bold text-gray-400 uppercase">Información para la comanda</p>
              </div>
              <button type="button" onClick={() => setIsCheckoutModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-400">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 pt-4 space-y-6">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Nombre / Apodo</label>
                <input 
                  type="text" 
                  required
                  autoFocus
                  placeholder="Ej: Juan Pérez"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-lg font-bold focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Teléfono (WhatsApp) - <span className="text-blue-400">Opcional</span></label>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold border-r pr-3">+54</div>
                  <input 
                    type="tel" 
                    placeholder="11 1234 5678"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-20 pr-5 py-4 text-lg font-bold focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-2 font-medium">Opcional. Si lo ingresás, el pedido quedará vinculado a su historial.</p>
              </div>

              <div className="bg-blue-50 rounded-2xl p-4 flex justify-between items-center border border-blue-100">
                <span className="text-sm font-bold text-blue-700">Total a Cobrar</span>
                <span className="text-2xl font-black text-blue-600">${cartTotal.toLocaleString('es-AR')}</span>
              </div>
            </div>

            <div className="p-8 pt-0 mt-2">
              <button
                type="submit"
                disabled={isCreatingOrder}
                className="w-full py-5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-2xl font-black text-lg transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3"
              >
                {isCreatingOrder ? (
                  <div className="w-6 h-6 border-4 border-t-transparent border-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Check size={28} />
                    CONFIRMAR Y ENVIAR
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── SUCCESS OVERLAY ── */}
      {showSuccess && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-blue-600 p-4 animate-in fade-in duration-300">
          <div className="text-center text-white space-y-8 max-w-lg w-full">
            <div className="flex justify-center">
              <div className="bg-white text-blue-600 p-8 rounded-full shadow-2xl animate-bounce">
                <Check size={80} />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-5xl font-black tracking-tighter">¡PEDIDO ENVIADO!</h1>
              <p className="text-xl font-bold opacity-80 uppercase tracking-widest">Ya está en la cocina</p>
            </div>
            <button 
              onClick={() => setShowSuccess(false)}
              className="w-full py-6 bg-white text-blue-600 rounded-[32px] font-black text-2xl shadow-xl active:scale-95 transition-all"
            >
              NUEVO PEDIDO
            </button>
          </div>
        </div>
      )}

      <NewOrderAlertModal />
    </div>
  );
}
