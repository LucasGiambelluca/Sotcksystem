import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { createOrder } from '../services/orderService';
import { toast } from 'sonner';
import { 
  Search, Plus, Minus, X, Check,
  Wifi, Settings, Bell, UserRound, ArrowRight,
  UtensilsCrossed, Tag
} from 'lucide-react';
import type { CatalogItem } from '../types';

const BASE_URL = import.meta.env.BASE_URL || '/';

const CATEGORY_ICONS: Record<string, any> = {
  'Empanadas': <img src={`${BASE_URL}icons/empanada_menu_icon_1774959117370.png`} className="w-6 h-6 rounded-md shadow-sm object-cover shrink-0" alt="Empanadas" />,
  'Pizzas': <img src={`${BASE_URL}icons/pizza_menu_icon_1774959638984.png`} className="w-6 h-6 rounded-md shadow-sm object-cover shrink-0" alt="Pizzas" />,
  'Hamburguesas': <img src={`${BASE_URL}icons/burger_menu_icon_1774959672650.png`} className="w-6 h-6 rounded-md shadow-sm object-cover shrink-0" alt="Hamburguesas" />,
  'Sándwiches': <img src={`${BASE_URL}icons/burger_menu_icon_1774959672650.png`} className="w-6 h-6 rounded-md shadow-sm object-cover shrink-0" alt="Sándwiches" />,
  'Bebidas': <img src={`${BASE_URL}icons/drink_menu_icon_1774959692339.png`} className="w-6 h-6 rounded-md shadow-sm object-cover shrink-0" alt="Bebidas" />,
  'Postres': <img src={`${BASE_URL}icons/dessert_menu_icon_1774959708367.png`} className="w-6 h-6 rounded-md shadow-sm object-cover shrink-0" alt="Postres" />,
  'Guarniciones': <img src={`${BASE_URL}icons/papas_menu_icon_1774959655911.png`} className="w-6 h-6 rounded-md shadow-sm object-cover shrink-0" alt="Guarniciones" />,
  'Pizzas Especiales': <img src={`${BASE_URL}icons/pizza_menu_icon_1774959638984.png`} className="w-6 h-6 rounded-md shadow-sm object-cover shrink-0" alt="Pizzas Especiales" />,
  'Bebidas sin alcohol': <img src={`${BASE_URL}icons/drink_menu_icon_1774959692339.png`} className="w-6 h-6 rounded-md shadow-sm object-cover shrink-0" alt="Bebidas sin alcohol" />,
  'Promos': <Tag size={18} className="text-slate-500" />,
  'Todos': <UtensilsCrossed size={18} className="text-slate-500" />,
  'default': <UtensilsCrossed size={18} className="text-slate-400" />
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
      let clientId = '';
      const cleanPhone = customerPhone.replace(/\D/g, '');
      
      if (cleanPhone) {
        const { data: existingList } = await supabase
          .from('clients')
          .select('id')
          .eq('phone', cleanPhone)
          .limit(1);
        
        if (existingList && existingList.length > 0) {
          clientId = existingList[0].id;
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
        const { data: mostradorList } = await supabase
          .from('clients')
          .select('id')
          .ilike('name', 'Venta Mostrador')
          .limit(1);
        
        if (mostradorList && mostradorList.length > 0) {
          clientId = mostradorList[0].id;
        } else {
          const { data: nw, error: nwe } = await supabase
            .from('clients')
            .insert({ name: 'Venta Mostrador' })
            .select()
            .single();
          if (nwe) throw nwe;
          clientId = nw?.id || '';
        }
      }

      if (!clientId) throw new Error('No se pudo determinar el cliente');

      const orderData = {
        client_id: clientId,
        channel: 'TABLET' as any,
        delivery_type: 'PICKUP',
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
    } catch (err: any) {
      toast.error('Error al crear pedido: ' + err.message);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-gray-500 bg-slate-50">Cargando menú...</div>;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      
      {/* ── LEFT SIDEBAR: CATEGORIES ── */}
      <div className="hidden md:flex flex-col w-64 bg-slate-50 border-r border-slate-200">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Culinary Curator</h1>
          <p className="text-sm font-medium text-slate-400 mt-1">Terminal #04</p>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
                activeCategory === cat
                  ? 'bg-slate-200/70 text-slate-900'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              <div className={activeCategory === cat ? 'text-slate-800' : 'text-slate-400'}>
                {CATEGORY_ICONS[cat] || CATEGORY_ICONS.default}
              </div>
              {cat}
            </button>
          ))}
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-200 mt-auto">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                <UserRound size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">Admin User</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Shift Manager</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── CENTRAL AREA: PRODUCTS ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Header */}
        <header className="px-8 py-6 flex items-center justify-between gap-6 border-b border-slate-100/50 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-4 min-w-[200px]">
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">
              {activeCategory === 'Todos' ? 'Menú Completo' : activeCategory}
            </h2>
            <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold leading-none tracking-wide hidden lg:block">
              {filteredItems.length} ITEMS
            </div>
          </div>

          <div className="flex-1 max-w-md hidden sm:block">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search menu..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-600">
            <button className="p-2 hover:bg-slate-50 rounded-full transition-colors hidden sm:block"><Wifi size={20} /></button>
            <button className="p-2 hover:bg-slate-50 rounded-full transition-colors hidden lg:block"><Settings size={20} /></button>
            <button className="p-2 hover:bg-slate-50 rounded-full transition-colors"><Bell size={20} /></button>
          </div>
        </header>

        {/* Dynamic Product Grid */}
        <main className="flex-1 overflow-y-auto p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-max pb-32">
              {filteredItems.map((item, index) => {
                // Determine if this is a "Chef Special" style card (e.g., every 5th item just to showcase design variety, or if it matches a keyword)
                const isSpecial = item.name.toLowerCase().includes('temporada') || item.name.toLowerCase().includes('degustación');

                if (isSpecial) {
                    return (
                        <div key={item.id} className="bg-slate-900 rounded-[20px] p-6 text-white flex flex-col justify-between row-span-2 shadow-sm relative overflow-hidden group">
                           {/* Background abstract element (optional) */}
                           <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -translate-y-10 translate-x-10"></div>
                           
                           <div>
                               <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-[10px] font-bold tracking-widest uppercase mb-4 text-indigo-200">
                                   Chef's Special
                               </div>
                               <h3 className="text-3xl font-bold leading-tight mb-2 pr-4">{item.name}</h3>
                               <p className="text-slate-300 text-sm leading-relaxed max-w-[90%]">{item.description}</p>
                           </div>
                           
                           <div className="mt-8">
                               <button onClick={() => addToCart(item)} className="w-full bg-white text-slate-900 py-3 rounded-xl font-bold text-sm tracking-wide hover:bg-slate-50 transition-colors shadow-sm cursor-pointer">
                                  Ver Detalles
                               </button>
                           </div>
                        </div>
                    );
                }

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-[20px] p-4 flex flex-col border border-slate-100 hover:shadow-lg transition-all hover:border-slate-200 group"
                  >
                    <div className="relative h-44 mb-4 rounded-xl overflow-hidden bg-slate-50 shrink-0">
                      {item.image_url_1 ? (
                        <img src={item.image_url_1} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <UtensilsCrossed className="text-slate-200" size={40} />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col flex-1">
                      <h3 className="font-bold text-slate-800 text-[15px] leading-snug mb-2">{item.name}</h3>
                      <p className="text-[13px] text-slate-500 leading-relaxed mb-4 line-clamp-3">{item.description}</p>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-2">
                       <span className="font-bold text-blue-600 text-lg tracking-tight">${item.price.toLocaleString('es-AR')}</span>
                       <button onClick={() => addToCart(item)} className="bg-slate-900 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm hover:bg-slate-800 active:scale-95 transition-all shadow-sm">
                          <Plus size={16} />
                          Agregar
                       </button>
                    </div>
                  </div>
                );
              })}
            </div>
        </main>
      </div>

      {/* ── RIGHT SIDEBAR: CART ── */}
      <div className="w-80 lg:w-[350px] xl:w-[400px] bg-slate-50 border-l border-slate-200 flex flex-col z-20 shrink-0 shadow-lg md:shadow-none">
        <div className="px-6 py-6 pb-2">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">Resumen de Comanda</h2>
             <div className="p-2 text-slate-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h16"/><path d="M4 14h16"/><path d="M5 22h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2Z"/></svg>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="bg-slate-200 text-slate-700 font-bold text-[11px] px-3 py-1 rounded-sm tracking-widest whitespace-nowrap uppercase">
                 Tablet {Math.floor(Math.random() * 5) + 1}
             </div>
             <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs whitespace-nowrap">
                 <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                 Active Order
             </div>
          </div>
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3 opacity-60">
              <UtensilsCrossed size={48} />
              <p className="font-bold text-sm">EL PEDIDO ESTÁ VACÍO</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex gap-4 items-center group">
                <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-white border border-slate-100 shadow-sm">
                  {item.image_url_1 ? (
                      <img src={item.image_url_1} className="w-full h-full object-cover" alt="" />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100/50 text-slate-300"><UtensilsCrossed size={20}/></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <h4 className="font-bold text-slate-800 text-[13px] truncate pr-2">{item.name}</h4>
                    <span className="font-black text-slate-900 text-[13px]">${item.price.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                      <p className="text-[11px] text-slate-400 font-medium">x{item.quantity} Unidades</p>
                      
                      <div className="flex items-center bg-blue-50 rounded-full p-0.5">
                        <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center text-blue-600 rounded-full hover:bg-blue-100 transition-colors">
                          <Minus size={12} strokeWidth={3} />
                        </button>
                        <span className="w-6 text-center font-bold text-xs text-blue-900">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, +1)} className="w-6 h-6 flex items-center justify-center text-blue-600 rounded-full hover:bg-blue-100 transition-colors">
                          <Plus size={12} strokeWidth={3} />
                        </button>
                      </div>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Service Preference Placeholder Note (From reference image) */}
          {cart.length > 0 && (
              <div className="mt-6 p-4 bg-slate-100 rounded-2xl flex gap-3 text-slate-600 border border-slate-200">
                  <div className="mt-0.5 text-slate-700">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21.2 8.4c.5.5.8 1.1.8 1.8V16c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-5.8c0-.7.3-1.3.8-1.8l7.6-7.5c.9-.9 2.3-.9 3.2 0l7.6 7.5zM12 4.2L5.2 11H18.8L12 4.2z"/></svg>
                  </div>
                  <div>
                      <p className="text-xs font-bold text-slate-800">Service Preference</p>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5">Serve all items together</p>
                  </div>
              </div>
          )}
        </div>

        {/* Order Totals Footer */}
        <div className="p-6 bg-white shrink-0 shadow-[0_-4px_25px_-5px_rgba(0,0,0,0.05)] border-t border-slate-100">
          <div className="space-y-3 mb-6">
             <div className="flex justify-between items-center text-xs font-medium text-slate-500">
                  <span>Subtotal</span>
                  <span>${cartTotal.toLocaleString('es-AR')}</span>
             </div>
             {/* Adding dummy Service Fee to match design if we want, or keeping it strictly functional. I will omit Service fee calculation and just show Total clearly */}
             <div className="border-t border-slate-200 border-dashed my-3"></div>
             <div className="flex justify-between items-center">
                  <span className="text-sm font-black text-slate-900 tracking-wider">TOTAL</span>
                  <span className="text-xl font-bold text-blue-600">${cartTotal.toLocaleString('es-AR')}</span>
             </div>
          </div>
          
          <button
            onClick={() => setIsCheckoutModalOpen(true)}
            disabled={isCreatingOrder || cart.length === 0}
            className="w-full py-4 bg-slate-900 hover:bg-black disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-[13px] tracking-widest transition-all shadow-md flex items-center justify-center gap-2 group"
          >
            ENVIAR A COCINA
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* ── CHECKOUT MODAL (Kept Functional with some matching styling) ── */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setIsCheckoutModalOpen(false)}>
          <div
            className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in duration-200 border border-slate-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-8 pb-4 flex justify-between items-center border-b border-slate-50">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">DATOS DEL CLIENTE</h2>
                <p className="text-[11px] font-bold text-slate-400 uppercase mt-1">Información para la comanda</p>
              </div>
              <button type="button" onClick={() => setIsCheckoutModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-400">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 pt-6 space-y-6">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Nombre / Apodo</label>
                <input 
                  type="text" 
                  required
                  autoFocus
                  placeholder="Ej: Juan Pérez"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Teléfono (Opcional)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold border-r border-slate-300 pr-3 text-sm">+54</div>
                  <input 
                    type="tel" 
                    placeholder="11 1234 5678"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-16 pr-4 py-3 text-sm font-bold focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all text-slate-900"
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center border border-slate-100">
                <span className="text-xs font-bold text-slate-600">Total a Cobrar</span>
                <span className="text-xl font-black text-slate-900">${cartTotal.toLocaleString('es-AR')}</span>
              </div>
            </div>

            <div className="p-8 pt-0">
              <button
                type="button"
                onClick={(e) => handleConfirmOrder(e as any)}
                disabled={isCreatingOrder}
                className="w-full py-4 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white rounded-xl font-bold text-[13px] tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
              >
                {isCreatingOrder ? (
                  <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Check size={18} />
                    CONFIRMAR Y ENVIAR
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification is now handled via toast only per user request */}
    </div>
  );
}
