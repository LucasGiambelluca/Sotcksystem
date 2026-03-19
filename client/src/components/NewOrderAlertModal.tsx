import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { updateOrderStatus } from '../services/orderService';
import { toast } from 'sonner';
import { Check, X, ShoppingBag, MapPin, Package, DollarSign } from 'lucide-react';

interface IncomingOrderItem {
  name: string;
  quantity: number;
}

interface IncomingOrder {
  id: string;
  order_number: number;
  total_amount: number;
  delivery_address: string | null;
  delivery_type: string | null;
  phone: string;
  channel: string;
  chat_context: any;
  client_name: string | null;
  items_summary: string | null;
  items: IncomingOrderItem[];
}

// Notification sound using comanda.wav
const playAlertSound = (() => {
  let lastPlayed = 0;
  return () => {
    const now = Date.now();
    if (now - lastPlayed < 15000) return; // 15s debounce for the physical sound
    lastPlayed = now;
    try {
      // Try both absolute and relative paths to be super safe
      const audio = new Audio('/sounds/comanda.wav');
      audio.play().catch(() => {
        // Fallback to basename path if first fails
        const fallback = new Audio('/elpollocomilon/sounds/comanda.wav');
        fallback.play().catch(e => console.warn('Audio playback failed entirely:', e));
      });
    } catch (e) {
      console.warn('Audio API not available:', e);
    }
  };
})();

export default function NewOrderAlertModal() {
  const [queue, setQueue] = useState<IncomingOrder[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const processedIds = useRef<Set<string>>(new Set());

  const fetchAndEnqueue = useCallback(async (orderId?: string) => {
    try {
      let query = supabase
        .from('orders')
        .select(`
          id, order_number, total_amount, delivery_address, delivery_type, phone, channel, chat_context, 
          client:clients(name),
          order_items(quantity, catalog_item:catalog_items(name))
        `)
        .eq('status', 'PENDING');

      if (orderId) {
        query = query.eq('id', orderId);
      } else {
        query = query.order('created_at', { ascending: false }).limit(5);
      }

      const { data, error } = orderId ? await query.single() : await query;
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

      const orders = Array.isArray(data) ? data : data ? [data] : [];

      for (const raw of orders) {
        if (processedIds.current.has(raw.id)) continue;
        processedIds.current.add(raw.id);

        const clientName = (raw as any).client?.name || raw.chat_context?.pushName || null;
        const address = raw.delivery_address 
          || raw.chat_context?.direccion 
          || raw.chat_context?.address 
          || raw.chat_context?.delivery_address 
          || null;
        const deliveryType = raw.delivery_type 
          || raw.chat_context?.delivery_type 
          || raw.chat_context?.tipo_entrega 
          || raw.chat_context?.delivery_method 
          || null;

        const items: IncomingOrderItem[] = (raw as any).order_items?.map((oi: any) => ({
          name: oi.catalog_item?.name || 'Desconocido',
          quantity: oi.quantity
        })) || [];

        const order: IncomingOrder = {
          id: raw.id,
          order_number: raw.order_number,
          total_amount: raw.total_amount,
          delivery_address: address,
          delivery_type: deliveryType,
          phone: raw.phone,
          channel: raw.channel,
          chat_context: raw.chat_context,
          client_name: clientName,
          items_summary: null,
          items,
        };

        setQueue((prev) => {
          if (prev.find((o) => o.id === order.id)) return prev;
          playAlertSound();
          return [...prev, order];
        });
      }
    } catch (err) {
      console.error('[NewOrderAlert] Error fetching order:', err);
    }
  }, []);

  useEffect(() => {
    // Subscribe to new orders via realtime
    const channel = supabase
      .channel('global-new-order-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const newId = (payload.new as any)?.id;
          // Minimal delay to ensure DB transaction committed (Supabase Realtime can sometimes be very fast)
          setTimeout(() => fetchAndEnqueue(newId), 100);
        }
      )
      .subscribe((status) => {
        console.log('[NewOrderAlert] Realtime status:', status);
      });

    // Check for any existing pending orders on mount
    fetchAndEnqueue();

    // Periodic fallback check (every 15s) in case realtime misses an event
    const fallbackInterval = setInterval(() => {
      fetchAndEnqueue();
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(fallbackInterval);
    };
  }, [fetchAndEnqueue]);

  const handleConfirm = async (orderId: string) => {
    setConfirming(orderId);
    // Remove from queue immediately for snappy UX
    setQueue((prev) => prev.filter((o) => o.id !== orderId));
    
    try {
      await updateOrderStatus(orderId, 'IN_PREPARATION');
      toast.success(`Pedido #${queue.find(o => o.id === orderId)?.order_number || ''} confirmado ✅`);
    } catch (err) {
      toast.error('Error al confirmar pedido');
      console.error(err);
    } finally {
      setConfirming(null);
    }
  };

  const handleDismiss = (orderId: string) => {
    setQueue((prev) => prev.filter((o) => o.id !== orderId));
  };

  if (queue.length === 0) return null;

  const currentAlert = queue[0];
  const displayAddress = currentAlert.delivery_address 
    || currentAlert.delivery_type 
    || 'Sin especificar / Retiro en local';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-300">
        {/* Header */}
        <div className="p-6 text-center bg-blue-600">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">¡NUEVO PEDIDO!</h2>
          <p className="text-blue-100 font-medium">
            #{currentAlert.order_number} · Entró por {currentAlert.channel === 'WHATSAPP' ? 'WhatsApp' : currentAlert.channel}
          </p>
        </div>
        
        {/* Body */}
        <div className="p-5 bg-gray-100">
          <div className="space-y-3 mb-5">
             {/* Client and Delivery Info Grid */}
             <div className="grid grid-cols-2 gap-3">
               <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1 flex items-center gap-1">
                    <Package className="w-3 h-3" /> Cliente
                  </p>
                  <p className="font-bold text-gray-800 text-sm truncate">
                    {currentAlert.client_name || currentAlert.phone || 'Desconocido'}
                  </p>
               </div>
               <div className={`p-3 rounded-xl border shadow-sm ${currentAlert.delivery_type?.toLowerCase().includes('env') ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Entrega
                  </p>
                  <p className={`font-bold text-sm truncate ${currentAlert.delivery_type?.toLowerCase().includes('env') ? 'text-orange-700' : 'text-green-700'}`}>
                    {displayAddress}
                  </p>
               </div>
             </div>

             {/* THE "COMANDA" TICKET */}
             <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-dashed border-gray-300 relative">
               <div className="bg-gray-50 border-b border-gray-200 py-2 px-4 flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Detalle de Comanda</span>
                  <ShoppingBag className="w-3 h-3 text-gray-300" />
               </div>
               
               <div className="p-4 max-h-[40vh] overflow-y-auto">
                 {currentAlert.items.map((item, idx) => (
                   <div key={idx} className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="flex-1 pr-4">
                        <p className="font-black text-gray-900 text-base leading-tight uppercase">
                          {item.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-black text-blue-600 text-xl bg-blue-50 px-2 rounded">
                          x{item.quantity}
                        </span>
                      </div>
                   </div>
                 ))}
                 
                 {currentAlert.items.length === 0 && (
                   <p className="text-center text-gray-400 italic py-4">Sin productos detectados</p>
                 )}
               </div>

               {/* Serrated edge effect simulation at the bottom */}
               <div className="h-2 bg-[radial-gradient(circle,transparent_0,transparent_4px,#f3f4f6_4px,#f3f4f6_10px)] bg-[length:20px_20px]"></div>
             </div>

             {/* Total Area */}
             <div className="flex justify-between items-center bg-gray-900 text-white p-4 rounded-xl shadow-xl">
               <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total a Cobrar</p>
                  <p className="text-2xl font-black text-green-400">
                    ${Number(currentAlert.total_amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
               </div>
               <div className="bg-white/10 p-3 rounded-full">
                  <DollarSign className="w-6 h-6 text-green-400" />
               </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => handleDismiss(currentAlert.id)}
              className="group flex flex-col items-center justify-center gap-1 py-3 px-4 bg-white border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95"
            >
              <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] uppercase">Ver después</span>
            </button>
            <button 
              onClick={() => handleConfirm(currentAlert.id)}
              disabled={confirming === currentAlert.id}
              className="group flex flex-col items-center justify-center gap-1 py-3 px-4 bg-green-500 text-white font-black rounded-2xl hover:bg-green-600 transition-all active:scale-95 shadow-lg shadow-green-500/40 disabled:opacity-50"
            >
              <Check className="w-6 h-6 group-hover:scale-125 transition-transform" />
              <span className="text-[10px] uppercase">{confirming === currentAlert.id ? 'Procesando...' : 'ACEPTAR Y PREPARAR'}</span>
            </button>
          </div>
          
          {queue.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
              <p className="text-center text-[10px] text-gray-500 font-black uppercase tracking-tighter">
                Hay {queue.length - 1} pedidos más esperando en cola
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
