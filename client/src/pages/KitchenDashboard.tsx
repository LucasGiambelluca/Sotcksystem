import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { VolumeX, Utensils, LogOut, Package, Minus, Layers, MapPin } from 'lucide-react';
import { useSound } from '../context/SoundContext';
import { shiftService } from '../services/shiftService';
import { stationService } from '../services/stationService';
import { updateOrderStatus } from '../services/orderService';
import { toast } from 'sonner';
import ShiftLogin from '../components/ShiftLogin';
import type { Shift, Station } from '../types';

// Types
interface OrderItem {
    id: string;
    quantity: number;
    unit_price: number;
    name: string;
    catalog_item_id?: string;
    product_id?: string;
}

interface Order {
    id: string;
    order_number: number;
    created_at: string;
    status: string;
    total_amount: number;
    items: OrderItem[];
    delivery_slot_id?: string;
    phone?: string;
    delivery_address?: string;
    delivery_type?: string;
    client_name?: string;
    chat_context?: any;
    isNew?: boolean;
}

// Timer Component for live elapsed time
const ElapsedTime = ({ startTime }: { startTime: string }) => {
    const [elapsed, setElapsed] = useState('');

    useEffect(() => {
        const calculateElapsed = () => {
            const start = new Date(startTime).getTime();
            const now = new Date().getTime();
            const diffMs = now - start;
            if (diffMs < 0) return '00:00';

            const diffMins = Math.floor(diffMs / 60000);
            const diffSecs = Math.floor((diffMs % 60000) / 1000);
            
            const formattedMins = String(diffMins).padStart(2, '0');
            const formattedSecs = String(diffSecs).padStart(2, '0');
            setElapsed(`${formattedMins}:${formattedSecs}`);
        };

        calculateElapsed();
        const interval = setInterval(calculateElapsed, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    return <span>{elapsed}</span>;
}

// --- Stock Consumption Modal ---
interface StockConsumptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    shift: Shift;
}

function StockConsumptionModal({ isOpen, onClose, shift }: StockConsumptionModalProps) {
    const [products, setProducts] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            supabase.from('products').select('id, name, stock, production_stock').eq('is_active', true).order('name').then(({ data }) => {
                setProducts(data || []);
            });
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!selectedProduct || quantity <= 0) return;
        setSubmitting(true);
        try {
            const product = products.find(p => p.id === selectedProduct);
            if (!product) throw new Error('Producto no encontrado');

            // Decrease production_stock
            const newProdStock = Math.max(0, (product.production_stock || 0) - quantity);
            await supabase
                .from('products')
                .update({ production_stock: newProdStock })
                .eq('id', selectedProduct);

            // Register movement
            await supabase.from('stock_movements').insert({
                product_id: selectedProduct,
                type: 'SALE',
                quantity: -quantity,
                description: `Consumo en ${shift.station?.name || 'cocina'} por ${shift.employee?.name || 'empleado'}`,
                shift_id: shift.id,
                employee_id: shift.employee_id,
            });

            toast.success(`Descontado: ${quantity}x ${product.name}`);
            setSelectedProduct('');
            setQuantity(1);
            onClose();
        } catch (err) {
            console.error(err);
            toast.error('Error al registrar consumo');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Minus size={18} className="text-red-500" /> Registrar Consumo de Insumo
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Turno: {shift.employee?.name} — {shift.station?.name}
                    </p>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Insumo</label>
                        <select
                            value={selectedProduct}
                            onChange={e => setSelectedProduct(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
                        >
                            <option value="">Seleccionar...</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} (Stock: {p.production_stock || 0})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Cantidad</label>
                        <input
                            type="number"
                            min={1}
                            value={quantity}
                            onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
                        />
                    </div>
                </div>
                <div className="p-5 border-t border-gray-100 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !selectedProduct}
                        className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:bg-gray-300 transition-all"
                    >
                        {submitting ? 'Guardando...' : 'Descontar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Main Component ---
export default function KitchenDashboard() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [activeShifts, setActiveShifts] = useState<Record<string, Shift>>({}); // map of station_id -> Shift
    const [shiftLoading, setShiftLoading] = useState(true);
    const [showConsumption, setShowConsumption] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [stations, setStations] = useState<Station[]>([]);
    const [activeViewStationId, setActiveViewStationId] = useState<string | 'ALL'>('ALL'); // 'ALL' or station.id
    const { soundEnabled, enableSound, disableSound, playNotification } = useSound();

    // Check for saved shifts in localStorage
    useEffect(() => {
        const savedShiftIdsStr = localStorage.getItem('kitchen_active_shift_ids');
        if (savedShiftIdsStr) {
            try {
                const shiftIds = JSON.parse(savedShiftIdsStr);
                if (Array.isArray(shiftIds) && shiftIds.length > 0) {
                    supabase
                        .from('shifts')
                        .select('*, employee:employees(*), station:stations(*)')
                        .in('id', shiftIds)
                        .eq('status', 'ACTIVE')
                        .then(({ data }) => {
                            if (data && data.length > 0) {
                                const newActiveShifts: Record<string, Shift> = {};
                                const validShiftIds: string[] = [];
                                data.forEach(shift => {
                                    newActiveShifts[shift.station_id] = shift as Shift;
                                    validShiftIds.push(shift.id);
                                });
                                setActiveShifts(newActiveShifts);
                                localStorage.setItem('kitchen_active_shift_ids', JSON.stringify(validShiftIds));
                            } else {
                                localStorage.removeItem('kitchen_active_shift_ids');
                            }
                            setShiftLoading(false);
                        });
                    return;
                }
            } catch (e) {
                localStorage.removeItem('kitchen_active_shift_ids');
            }
        }
        setShiftLoading(false);
    }, []);

    useEffect(() => {
        fetchOrders();

        // Load all stations for tabs
        stationService.getAll().then(sts => setStations(sts));
        
        const channel = supabase
            .channel('public:orders:kitchen')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
                console.log('New Order received!', payload);
                playNotification();
                setTimeout(fetchOrders, 500);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [playNotification]);

    const mapDBToLocalStatus = (dbStatus: string | undefined | null) => {
        if (!dbStatus) return 'pending';
        const s = dbStatus.toUpperCase();
        if (s === 'PENDING') return 'pending';
        if (s === 'CONFIRMED') return 'confirmed';
        if (s === 'IN_PREPARATION') return 'preparing';
        if (s === 'IN_TRANSIT' || s === 'PICKED_UP' || s === 'OUT_FOR_DELIVERY') return 'ready';
        if (s === 'DELIVERED') return 'delivered';
        return s.toLowerCase();
    };

    const mapLocalToDBStatus = (localStatus: string) => {
        if (localStatus === 'pending') return 'PENDING';
        if (localStatus === 'confirmed') return 'CONFIRMED';
        if (localStatus === 'preparing') return 'IN_PREPARATION';
        if (localStatus === 'ready') return 'IN_TRANSIT';
        if (localStatus === 'delivered') return 'DELIVERED';
        return localStatus.toUpperCase();
    };

    const fetchOrders = async () => {
        // We avoid filtering by values that might not exist in the enum yet to prevent query crashes
        // The core statuses are PENDING, CONFIRMED, IN_PREPARATION, IN_TRANSIT, DELIVERED
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                client:clients(name),
                order_items(
                    id, quantity, unit_price, catalog_item_id, product_id,
                    catalog_item:catalog_items(name)
                )
            `)
            .not('status', 'in', '("DELIVERED","CANCELLED")') // Use only core statuses that definitely exist
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) {
            console.error('Kitchen fetch error:', error);
            // toast.error('Error al cargar pedidos');
            return;
        }

        if (data) {
            setOrders(prevOrders => {
                const newData = data.map((rawOrder: any) => {
                    // Build items array with names resolved
                    const items: OrderItem[] = (rawOrder.order_items || []).map((oi: any) => ({
                        id: oi.id,
                        quantity: oi.quantity,
                        unit_price: oi.unit_price,
                        name: oi.catalog_item?.name || oi.name || 'Producto',
                        catalog_item_id: oi.catalog_item_id,
                        product_id: oi.product_id,
                    }));

                    // If no order_items rows, try to extract from chat_context
                    if (items.length === 0 && rawOrder.chat_context?.created_order) {
                        // Fallback: items might have been passed in context
                    }

                    const normalizedOrder: Order = {
                        id: rawOrder.id,
                        order_number: rawOrder.order_number,
                        created_at: rawOrder.created_at,
                        status: mapDBToLocalStatus(rawOrder.status),
                        total_amount: rawOrder.total_amount,
                        items,
                        delivery_slot_id: rawOrder.delivery_slot_id,
                        phone: rawOrder.phone,
                        delivery_address: rawOrder.delivery_address,
                        delivery_type: rawOrder.delivery_type,
                        client_name: rawOrder.client?.name || rawOrder.chat_context?.pushName || null,
                        chat_context: rawOrder.chat_context,
                    };

                    const existingOrder = prevOrders.find(o => o.id === normalizedOrder.id);
                    if (!existingOrder && normalizedOrder.status === 'pending' && prevOrders.length > 0) {
                        return { ...normalizedOrder, isNew: true };
                    }
                    return normalizedOrder;
                });
                return newData;
            });
        }
    };

    useEffect(() => {
        const hasNew = orders.some(o => o.isNew);
        if (hasNew) {
            const timer = setTimeout(() => {
                setOrders(prev => prev.map(o => ({ ...o, isNew: false })));
            }, 8000);
            return () => clearTimeout(timer);
        }
    }, [orders]);

    const updateStatus = async (orderId: string, newStatus: string) => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus, isNew: false } : o));

        const dbStatus = mapLocalToDBStatus(newStatus);
        
        try {
            await updateOrderStatus(orderId, dbStatus as any);
        } catch (error) {
            console.error('Error updating status:', error);
            fetchOrders();
        }
    };

    const handleShiftStarted = (shift: Shift) => {
        setActiveShifts(prev => {
            const updated = { ...prev, [shift.station_id]: shift };
            const shiftIds = Object.values(updated).map(s => s.id);
            localStorage.setItem('kitchen_active_shift_ids', JSON.stringify(shiftIds));
            return updated;
        });
        setActiveViewStationId(shift.station_id);
        setShowLoginModal(false);
        enableSound();
    };

    const handleEndShift = async (shiftToEnded: Shift) => {
        try {
            await shiftService.endShift(shiftToEnded.id);
            
            setActiveShifts(prev => {
                const updated = { ...prev };
                delete updated[shiftToEnded.station_id];
                const shiftIds = Object.values(updated).map(s => s.id);
                localStorage.setItem('kitchen_active_shift_ids', JSON.stringify(shiftIds));
                return updated;
            });
            
            if (Object.keys(activeShifts).length === 1) disableSound(); // Disable sound if it was the last shift
            toast.success('Turno finalizado');
        } catch (err) {
            console.error(err);
            toast.error('Error al finalizar turno');
        }
    };

    // TAB STATE - Active tab for main view
    const [activeTab, setActiveTab] = useState<'pending' | 'cooking' | 'ready'>('pending');

    // Pending = pending + confirmed
    const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'confirmed');
    const cookingOrders = orders.filter(o => o.status === 'preparing');
    const readyOrders = orders.filter(o => o.status === 'ready');

    const activeTabOrders =
        activeTab === 'pending' ? pendingOrders :
        activeTab === 'cooking' ? cookingOrders :
        readyOrders;

    const fmtCurrency = (n: number) => `$${Number(n || 0).toLocaleString('es-AR')}`;

    // Loading shift check
    if (shiftLoading) {
        return <div className="min-h-screen bg-[#111827] flex items-center justify-center"><div className="text-gray-400 text-lg animate-pulse">Cargando...</div></div>;
    }

    const currentShift = activeViewStationId !== 'ALL' ? activeShifts[activeViewStationId] : null;
    const currentStation = activeViewStationId !== 'ALL' ? stations.find(s => s.id === activeViewStationId) : null;
    let shiftHrs = 0;
    let shiftMins = 0;
    if (currentShift) {
        const shiftElapsedMs = Date.now() - new Date(currentShift.start_time).getTime();
        shiftHrs = Math.floor(shiftElapsedMs / 3600000);
        shiftMins = Math.floor((shiftElapsedMs % 3600000) / 60000);
    }

    const TAB_CFG = {
        pending: { label: 'Nuevos',    emoji: '🆕', color: 'bg-orange-500', count: pendingOrders.length },
        cooking: { label: 'En Cocina', emoji: '🔥', color: 'bg-red-500',    count: cookingOrders.length },
        ready:   { label: 'Listos',    emoji: '✅', color: 'bg-green-500',  count: readyOrders.length },
    } as const;

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans select-none">

            {/* ── TOP HEADER ── */}
            <header className="bg-white px-4 py-3 flex justify-between items-center shrink-0 border-b border-gray-200 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl text-white shadow-lg" style={{ backgroundColor: currentStation?.color || '#3b82f6' }}>
                        <Utensils size={22} />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-[#1e293b] leading-tight">
                            {currentStation ? currentStation.name : 'Monitor Principal'}
                        </h1>
                        <p className="text-xs text-gray-400">
                            {currentShift
                                ? `${currentShift.employee?.name} · ${shiftHrs}h ${shiftMins}m`
                                : 'Vista General'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {currentShift && (
                        <button onClick={() => setShowConsumption(true)}
                            className="p-2.5 bg-red-900/40 text-red-400 hover:bg-red-800/60 rounded-full border border-red-800/60 transition-colors"
                            title="Registrar consumo">
                            <Package size={17} />
                        </button>
                    )}
                    <button onClick={() => soundEnabled ? disableSound() : enableSound()}
                        className="p-2.5 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-full border border-gray-200 transition-colors"
                        title={soundEnabled ? 'Mutar' : 'Activar sonido'}>
                        <VolumeX size={17} />
                    </button>
                    {currentShift ? (
                        <button onClick={() => handleEndShift(currentShift)}
                            className="p-2.5 bg-gray-700 text-white hover:bg-gray-600 rounded-full transition-colors"
                            title="Finalizar turno">
                            <LogOut size={17} />
                        </button>
                    ) : (
                        <button onClick={() => setShowLoginModal(true)}
                            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold transition-colors shadow-md text-sm">
                            Iniciar Turno
                        </button>
                    )}
                </div>
            </header>

            {/* ── STATION TABS ── */}
            {stations.length > 0 && (
                <div className="bg-white px-3 py-2 border-b border-gray-200 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                    <button onClick={() => setActiveViewStationId('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeViewStationId === 'ALL' ? 'bg-[#1e293b] text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                        <Layers size={14} />
                        Todas las Estaciones
                    </button>
                    {stations.map(st => {
                        const isActive = activeViewStationId === st.id;
                        const shiftForStation = activeShifts[st.id];
                        return (
                            <button key={st.id} onClick={() => setActiveViewStationId(st.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${isActive ? 'text-white border-transparent shadow-md' : 'text-gray-500 border-gray-100 bg-gray-50 hover:bg-gray-100'}`}
                                style={isActive ? { backgroundColor: st.color } : {}}>
                                {st.name}
                                {shiftForStation && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-500'}`}>
                                        {shiftForStation.employee?.name}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── MAIN TAB BAR ── */}
            <div className="bg-white px-3 pt-3 pb-0 border-b border-gray-200 flex gap-1 shrink-0">
                {(Object.entries(TAB_CFG) as [keyof typeof TAB_CFG, typeof TAB_CFG[keyof typeof TAB_CFG]][]).map(([key, cfg]) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`relative flex-1 pb-3 pt-2 px-2 rounded-t-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === key ? 'bg-[#f8fafc] text-[#1e293b]' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <span>{cfg.emoji}</span>
                        <span className="hidden sm:inline">{cfg.label}</span>
                        {cfg.count > 0 && (
                            <span className={`min-w-[22px] h-[22px] flex items-center justify-center rounded-full text-xs font-black text-white px-1.5 ${cfg.color} shadow-sm`}>
                                {cfg.count}
                            </span>
                        )}
                        {activeTab === key && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full shadow-[0_-2px_4px_rgba(37,99,235,0.3)]" />
                        )}
                    </button>
                ))}
            </div>

            {/* ── ORDER CARDS ── */}
            <main className="flex-1 overflow-y-auto p-3 space-y-3 pb-28">
                {activeTabOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center pt-20 text-gray-600 gap-3">
                        <span className="text-5xl opacity-30">
                            {activeTab === 'pending' ? '🛒' : activeTab === 'cooking' ? '🍳' : '🏁'}
                        </span>
                        <p className="font-medium text-gray-500">
                            {activeTab === 'pending' ? 'Sin pedidos nuevos' : activeTab === 'cooking' ? 'Nada en preparación' : 'Ningún pedido listo'}
                        </p>
                    </div>
                )}

                {activeTabOrders.map(order => {
                    const isPending = order.status === 'pending';
                    const isConfirmed = order.status === 'confirmed';
                    const isCooking = order.status === 'preparing';
                    const isReady = ['ready', 'completed'].includes(order.status);

                    const borderColor = isPending ? '#f97316' : isConfirmed ? '#3b82f6' : isCooking ? '#ef4444' : '#22c55e';
                    const bgBadge = isPending ? 'bg-orange-100 text-orange-600 border border-orange-200' : isConfirmed ? 'bg-blue-100 text-blue-600 border border-blue-200' : isCooking ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-green-100 text-green-600 border border-green-200';
                    const statusLabel = isPending ? 'PENDIENTE' : isConfirmed ? 'CONFIRMADO' : isCooking ? 'COCINANDO' : 'LISTO';

                    return (
                        <div
                            key={order.id}
                            className={`bg-white rounded-2xl overflow-hidden relative transition-all duration-300 shadow-sm border border-gray-100 ${order.isNew ? 'ring-2 ring-orange-400 shadow-orange-500/20 shadow-xl' : ''}`}
                            style={{ borderLeft: `5px solid ${borderColor}` }}
                        >
                            <div className="p-4">
                                {/* Card Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-gray-400 text-[10px] font-mono font-bold tracking-tighter">ORD# {order.order_number || order.id.slice(0,5)}</span>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${bgBadge}`}>{statusLabel}</span>
                                        </div>
                                        <h3 className="text-[#0f172a] text-xl font-black leading-tight">
                                            {order.client_name || order.phone || 'Cliente'}
                                        </h3>
                                        {(order.delivery_address || order.delivery_type) && (
                                            <p className="text-gray-500 text-xs font-medium mt-0.5 flex items-center gap-1">
                                                <MapPin size={12} className="text-blue-500" />
                                                {order.delivery_address || order.delivery_type}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span className={`text-base font-black ${isCooking || isPending ? 'text-red-600 animate-pulse' : 'text-gray-400'}`}>
                                            <ElapsedTime startTime={order.created_at} />
                                        </span>
                                        <span className="text-emerald-600 font-bold text-sm bg-emerald-50 px-2 rounded-lg border border-emerald-100">{fmtCurrency(order.total_amount)}</span>
                                    </div>
                                </div>

                                {/* Items */}
                                {order.items && order.items.length > 0 ? (
                                    <div className="space-y-1.5 mb-4">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                                                <span className="text-blue-600 font-black text-xl w-8 text-center shrink-0">
                                                    {item.quantity}×
                                                </span>
                                                <span className="text-[#1e293b] font-bold text-base flex-1 leading-tight tracking-tight">{item.name}</span>
                                                <span className="text-gray-400 text-[10px] font-mono shrink-0">{fmtCurrency(item.unit_price)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mb-4 bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-3 text-yellow-400 text-sm">
                                        ⚠️ Sin ítems detallados — revisar pedido
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex gap-2">
                                    {isPending && (
                                        <button onClick={() => updateStatus(order.id, 'confirmed')}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black py-4 rounded-xl transition-all text-base shadow-lg">
                                            CONFIRMAR
                                        </button>
                                    )}
                                    {isConfirmed && (
                                        <button onClick={() => updateStatus(order.id, 'preparing')}
                                            className="flex-1 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black py-4 rounded-xl transition-all text-base shadow-lg">
                                            🔥 EMPEZAR A COCINAR
                                        </button>
                                    )}
                                    {isCooking && (
                                        <button onClick={() => updateStatus(order.id, 'ready')}
                                            className="flex-1 bg-green-500 hover:bg-green-600 active:scale-95 text-white font-black py-4 rounded-xl transition-all text-base shadow-lg shadow-green-500/20 border-b-4 border-green-700">
                                            {order.delivery_address ? '📞 LLAMAR CADETE' : '🥡 LISTO PARA RETIRAR'}
                                        </button>
                                    )}
                                    {isReady && (
                                        <button onClick={() => updateStatus(order.id, 'delivered')}
                                            className="flex-1 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-black py-4 rounded-xl transition-all text-base border border-gray-200">
                                            {order.delivery_address ? '🚚 ENTREGADO' : '🛍️ RETIRADO'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </main>

            {/* ── LOGIN POPUP ── */}
            {showLoginModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="relative max-w-md w-full">
                        <button onClick={() => setShowLoginModal(false)}
                            className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg text-gray-500 hover:text-gray-800 z-10">
                            <Minus size={20} />
                        </button>
                        <div className="max-h-[85vh] overflow-y-auto no-scrollbar rounded-[28px]">
                            <ShiftLogin onShiftStarted={handleShiftStarted} />
                        </div>
                    </div>
                </div>
            )}

            {/* ── STOCK CONSUMPTION MODAL ── */}
            {currentShift && (
                <StockConsumptionModal
                    isOpen={showConsumption}
                    onClose={() => setShowConsumption(false)}
                    shift={currentShift}
                />
            )}
        </div>
    );
}


