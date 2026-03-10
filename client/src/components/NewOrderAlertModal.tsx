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

// Notification sound using simple oscillator (works after ANY user interaction on page)
const playAlertSound = (() => {
  let lastPlayed = 0;
  return () => {
    const now = Date.now();
    if (now - lastPlayed < 3000) return; // 3s debounce
    lastPlayed = now;
    try {
      const ctx = new (window.AudioContext || (window as unknown as any).webkitAudioContext)();
      // Play 3 short beeps for urgency
      [0, 0.25, 0.5].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.5, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.2);
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
          // Small delay to ensure DB transaction committed
          setTimeout(() => fetchAndEnqueue(newId), 500);
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
      await updateOrderStatus(orderId, 'CONFIRMED');
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
        <div className="p-6 bg-gray-50">
          <div className="space-y-4 mb-6">
             <div className="flex items-start gap-3">
               <div className="bg-blue-100 p-2 rounded-lg text-blue-600 mt-1">
                 <Package className="w-5 h-5" />
               </div>
               <div>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Cliente</p>
                  <p className="font-bold text-gray-900 text-lg">{currentAlert.client_name || currentAlert.phone || 'Desconocido'}</p>
               </div>
             </div>

             <div className="flex items-start gap-3">
               <div className="bg-orange-100 p-2 rounded-lg text-orange-600 mt-1">
                 <MapPin className="w-5 h-5" />
               </div>
               <div>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Entrega</p>
                  <p className="font-bold text-gray-900 text-lg">{displayAddress}</p>
               </div>
             </div>

             <div className="flex items-center gap-3">
               <div className="bg-green-100 p-2 rounded-lg text-green-600">
                 <DollarSign className="w-5 h-5" />
               </div>
               <div>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Total</p>
                  <p className="font-bold text-green-600 text-xl">${Number(currentAlert.total_amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
               </div>
             </div>

             {/* Order Items List */}
             <div className="flex items-start gap-3 border-t border-gray-100 pt-3 mt-3">
               <div className="bg-purple-100 p-2 rounded-lg text-purple-600 mt-1">
                 <ShoppingBag className="w-5 h-5" />
               </div>
               <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Detalle del Pedido</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {currentAlert.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm transition-all hover:border-purple-200">
                        <span className="font-bold text-gray-800 text-sm leading-tight">{item.name}</span>
                        <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2">x{item.quantity}</span>
                      </div>
                    ))}
                    {currentAlert.items.length === 0 && (
                      <p className="text-xs text-gray-400 italic py-1">Sin detalles disponibles</p>
                    )}
                  </div>
               </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => handleDismiss(currentAlert.id)}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
            >
              <X className="w-5 h-5" />
              Ver después
            </button>
            <button 
              onClick={() => handleConfirm(currentAlert.id)}
              disabled={confirming === currentAlert.id}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors shadow-lg shadow-green-500/30 disabled:opacity-50"
            >
              <Check className="w-5 h-5" />
              {confirming === currentAlert.id ? 'Confirmando...' : 'Aceptar Pedido'}
            </button>
          </div>
          
          {queue.length > 1 && (
            <p className="text-center text-xs text-gray-400 mt-4 font-medium">
              +{queue.length - 1} pedidos más esperando en cola...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
