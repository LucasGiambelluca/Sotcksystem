import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, CheckCircle, ChefHat, Truck } from 'lucide-react';

// Types
interface Order {
    id: string;
    created_at: string;
    status: string;
    total: number;
    items: any[];
    delivery_slot_id?: string;
    client_phone?: string;
    push_name?: string;
}

const COLUMNS = {
    'pending': { title: 'Pendientes', icon: <Clock />, color: 'bg-yellow-100 text-yellow-800' },
    'confirmed': { title: 'Confirmados', icon: <CheckCircle />, color: 'bg-blue-100 text-blue-800' },
    'preparing': { title: 'En Cocina', icon: <ChefHat />, color: 'bg-orange-100 text-orange-800' },
    'ready': { title: 'Listos / Enviados', icon: <Truck />, color: 'bg-green-100 text-green-800' }
};

export default function KitchenDashboard() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
        
        // Real-time subscription
        const channel = supabase
            .channel('public:orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                console.log('Change received!', payload);
                fetchOrders(); // Refresh simply for now
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchOrders = async () => {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50); // Last 50 active
        
        if (!error && data) setOrders(data);
        setLoading(false);
    };

    const updateStatus = async (orderId: string, newStatus: string) => {
        // Optimistic update
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

        const { error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);
            
        if (error) {
            console.error('Error updating status:', error);
            fetchOrders(); // Revert on error
        }
    };

    // Group by status
    const columns = {
        'pending': orders.filter(o => o.status === 'pending'),
        'confirmed': orders.filter(o => o.status === 'confirmed'),
        'preparing': orders.filter(o => o.status === 'preparing'),
        'ready': orders.filter(o => ['ready', 'completed', 'delivered'].includes(o.status)),
    };

    if (loading) return <div className="p-10 text-center">Cargando Cocina...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <ChefHat className="text-pink-600" />
                    KitchenFlow Dashboard
                </h1>
                <div className="text-sm text-gray-500">
                    Actualización en tiempo real • {orders.length} pedidos activos
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[calc(100vh-150px)]">
                {Object.entries(COLUMNS).map(([status, config]) => (
                    <div key={status} className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
                        <div className={`p-3 font-semibold flex items-center gap-2 border-b ${config.color} rounded-t-xl bg-opacity-50`}>
                            {config.icon}
                            {config.title}
                            <span className="ml-auto bg-white/50 px-2 rounded-full text-xs">
                                {(columns as any)[status]?.length || 0}
                            </span>
                        </div>
                        
                        <div className="p-2 flex-1 overflow-y-auto space-y-2 bg-gray-50/50">
                            {(columns as any)[status]?.map((order: Order) => (
                                <div key={order.id} className="bg-white p-3 rounded border shadow-sm hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-mono text-xs text-gray-400">#{order.id.slice(0,6)}</span>
                                        <span className="text-xs font-medium">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <div className="font-bold text-gray-800 mb-1">{order.push_name || order.client_phone}</div>
                                    <div className="text-sm text-gray-600 mb-2">
                                        ${order.total} • {order.items?.length} items
                                    </div>
                                    
                                    <div className="space-y-1 mb-3">
                                        {order.items?.map((item, idx) => (
                                            <div key={idx} className="text-xs flex justify-between text-gray-500">
                                                <span>{item.quantity}x {item.name}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="flex gap-1 mt-2 pt-2 border-t">
                                        {status === 'pending' && (
                                            <button onClick={() => updateStatus(order.id, 'confirmed')} className="flex-1 bg-blue-50 text-blue-600 text-xs py-1 rounded hover:bg-blue-100">Confirmar</button>
                                        )}
                                        {status === 'confirmed' && (
                                            <button onClick={() => updateStatus(order.id, 'preparing')} className="flex-1 bg-orange-50 text-orange-600 text-xs py-1 rounded hover:bg-orange-100">Cocinar</button>
                                        )}
                                        {status === 'preparing' && (
                                            <button onClick={() => updateStatus(order.id, 'ready')} className="flex-1 bg-green-50 text-green-600 text-xs py-1 rounded hover:bg-green-100">Listo</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
