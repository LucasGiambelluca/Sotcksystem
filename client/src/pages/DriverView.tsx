
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Navigation, CheckCircle, XCircle, MapPin, Truck } from 'lucide-react';

interface RouteOrder {
    id: string;
    sequence_number: number;
    estimated_arrival: string;
    status: string;
    formatted_address: string;
    delivery_lat: number;
    delivery_lng: number;
    order: {
        id: string;
        client: {
            name: string;
            phone: string;
        };
    };
}

interface DriverRoute {
    id: string;
    name: string;
    status: string;
    start_address: string;
}

export default function DriverView() {
    const { id } = useParams();
    const [route, setRoute] = useState<DriverRoute | null>(null);
    const [orders, setOrders] = useState<RouteOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    useEffect(() => {
        fetchRoute();
    }, [id]);

    const fetchRoute = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/driver/routes/${id}`);
            if (!response.ok) throw new Error('Ruta no encontrada');
            
            const data = await response.json();
            setRoute(data.route);
            setOrders(data.orders);
        } catch (error) {
            console.error('Error fetching route:', error);
            toast.error('No se pudo cargar la ruta');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (orderId: string, status: 'DELIVERED' | 'FAILED', reason?: string) => {
        setUpdating(orderId);
        try {
            const response = await fetch(`${API_BASE}/api/driver/orders/${orderId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, reason })
            });

            if (!response.ok) throw new Error('Update failed');

            toast.success(status === 'DELIVERED' ? '¡Entrega confirmada!' : 'Registrado como fallido');
            
            // Optimistic update
            setOrders(orders.map(o => o.id === orderId ? { ...o, status } : o));

        } catch (error) {
            toast.error('Error al actualizar estado');
        } finally {
            setUpdating(null);
        }
    };

    const openNavigation = (lat: number, lng: number) => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        window.open(url, '_blank');
    };

    if (loading) return <div className="flex h-screen items-center justify-center bg-gray-100"><Loader2 className="animate-spin" /></div>;
    if (!route) return <div className="p-8 text-center">Ruta no encontrada o enlace inválido.</div>;

    // Filter out completed? Maybe show them at bottom?
    // Let's just list them all, identifying current.
    const activeIndex = orders.findIndex(o => o.status === 'PENDING' || o.status === 'IN_PROGRESS');
    const currentOrder = activeIndex !== -1 ? orders[activeIndex] : null;

    return (
        <div className="min-h-screen bg-gray-50 pb-10 font-sans">
            {/* Header */}
            <header className="bg-blue-600 text-white p-4 sticky top-0 z-10 shadow-md">
                <div className="flex items-center gap-2 mb-1">
                    <Truck size={20} />
                    <h1 className="font-bold text-lg leading-tight">{route.name}</h1>
                </div>
                <div className="text-blue-100 text-sm flex justify-between">
                    <span>{orders.filter(o => o.status === 'DELIVERED').length} / {orders.length} completados</span>
                    <span>{activeIndex !== -1 ? `Próx: #${orders[activeIndex].sequence_number}` : '¡Finalizado!'}</span>
                </div>
            </header>

            <main className="p-4 space-y-4">
                {/* Active Card */}
                {currentOrder && (
                    <div className="bg-white rounded-xl shadow-lg border-l-4 border-blue-500 overflow-hidden">
                        <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                                    PARADA #{currentOrder.sequence_number}
                                </span>
                                <span className="text-gray-500 text-xs flex items-center gap-1">
                                    🕒 {currentOrder.estimated_arrival?.slice(0,5) || '--:--'}
                                </span>
                            </div>
                            
                            <h2 className="text-xl font-bold text-gray-800 mb-1">{currentOrder.order.client?.name}</h2>
                            <p className="text-gray-600 text-sm mb-4 flex items-start gap-1">
                                <MapPin size={16} className="mt-0.5 shrink-0" />
                                {currentOrder.formatted_address}
                            </p>

                            <div className="grid grid-cols-1 gap-3">
                                <button 
                                    onClick={() => openNavigation(currentOrder.delivery_lat, currentOrder.delivery_lng)}
                                    className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-sm active:scale-95 transition-all"
                                >
                                    <Navigation size={20} />
                                    NAVEGAR
                                </button>
                                
                                <div className="grid grid-cols-2 gap-3 mt-2">
                                    <button 
                                        onClick={() => handleUpdateStatus(currentOrder.id, 'FAILED', 'No responde')}
                                        disabled={updating === currentOrder.id}
                                        className="flex flex-col items-center justify-center gap-1 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 py-3 rounded-lg font-medium text-sm active:scale-95 transition-all"
                                    >
                                        <XCircle size={20} />
                                        Fallido
                                    </button>
                                    <button 
                                        onClick={() => handleUpdateStatus(currentOrder.id, 'DELIVERED')}
                                        disabled={updating === currentOrder.id}
                                        className="flex flex-col items-center justify-center gap-1 bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 py-3 rounded-lg font-bold text-sm active:scale-95 transition-all"
                                    >
                                        {updating === currentOrder.id ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
                                        ENTREGADO
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* List of other stops */}
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-6 mb-2">
                    {activeIndex === -1 ? 'Resumen de Ruta' : 'Próximas Paradas'}
                </h3>
                
                <div className="space-y-3 opacity-90">
                    {orders.map((order, idx) => {
                        if (order.id === currentOrder?.id) return null; // Skip active
                        const isDone = order.status === 'DELIVERED';
                        const isFailed = order.status === 'FAILED';
                        
                        return (
                            <div key={order.id} className={`bg-white p-3 rounded-lg border ${isDone ? 'border-green-200 bg-green-50' : isFailed ? 'border-red-200 bg-red-50' : 'border-gray-100'} shadow-sm flex items-center justify-between`}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isDone ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                                            {order.sequence_number}
                                        </span>
                                        <span className={`font-medium ${isDone ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                            {order.order.client?.name}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 ml-8 truncate max-w-[200px]">
                                        {order.formatted_address}
                                    </p>
                                </div>
                                <div>
                                    {isDone && <CheckCircle size={16} className="text-green-500" />}
                                    {isFailed && <XCircle size={16} className="text-red-500" />}
                                    {!isDone && !isFailed && idx > activeIndex && <span className="text-gray-300 text-xs">Pendiente</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}
