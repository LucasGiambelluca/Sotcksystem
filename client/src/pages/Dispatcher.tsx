import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Users, 
  Package, 
  MapPin, 
  Navigation, 
  CheckCircle2, 
  Bike,
  Car,
  Truck,
  X,
  MoreVertical
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { logisticsV2Service } from '../services/logisticsV2Service';
import { toast } from 'sonner';
import { useSound } from '../context/SoundContext';

// Fix for default Leaflet icon not showing
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Types
interface CadeteWithLocation {
    id: string;
    employee_id: string;
    employee: { name: string };
    station: { name: string; color: string };
    metadata: { vehicle_type: string; phone: string } | null;
    latest_location: { lat: number; lng: number; last_updated: string } | null;
    is_online: boolean;
}

const BAHIA_BLANCA: [number, number] = [-38.7196, -62.2724];

interface PendingOrder {
    id: string;
    order_number: string;
    client_name: string;
    delivery_address: string;
    total_amount: number;
    status: string;
    created_at: string;
}

const Dispatcher: React.FC = () => {
    const [cadetes, setCadetes] = useState<CadeteWithLocation[]>([]);
    const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [selectedCadete, setSelectedCadete] = useState<string | null>(null);
    const [activeMission, setActiveMission] = useState<any>(null);
    const { playNotification } = useSound();
    const [prevCadeteCount, setPrevCadeteCount] = useState(0);

    useEffect(() => {
        if (selectedCadete) {
            fetchActiveMission();
        } else {
            setActiveMission(null);
        }
    }, [selectedCadete]);

    const fetchActiveMission = async () => {
        if (!selectedCadete) return;
        const data = await logisticsV2Service.getActiveMission(selectedCadete);
        setActiveMission(data);
    };

    const [realtimeStatus, setRealtimeStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'>('CONNECTING');

    useEffect(() => {
        let locationChannel: any, orderChannel: any, shiftChannel: any;

        const setupSubscriptions = async () => {
            try {
                setRealtimeStatus('CONNECTING');
                await fetchData();

                // 1. Location Channel
                locationChannel = supabase.channel('cadete-locations-despacho')
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cadete_locations' }, () => {
                        fetchCadetes();
                    })
                    .subscribe((status) => {
                        if (status === 'SUBSCRIBED') setRealtimeStatus('CONNECTED');
                        if (status === 'CHANNEL_ERROR') setRealtimeStatus('ERROR');
                    });

                // 2. Orders Channel
                orderChannel = supabase.channel('orders-despacho')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                        console.debug('Realtime order change', payload);
                        fetchOrders();
                    })
                    .subscribe();

                // 3. Shifts Channel
                shiftChannel = supabase.channel('shifts-despacho')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
                        fetchCadetes();
                    })
                    .subscribe();

            } catch (err) {
                console.error('Subscription setup failed:', err);
                setRealtimeStatus('ERROR');
                toast.error('Error de conexión en tiempo real');
            }
        };

        setupSubscriptions();

        return () => {
            if (locationChannel) supabase.removeChannel(locationChannel);
            if (orderChannel) supabase.removeChannel(orderChannel);
            if (shiftChannel) supabase.removeChannel(shiftChannel);
        };
    }, []);

    const fetchData = async () => {
        try {
            await Promise.all([fetchCadetes(), fetchOrders()]);
        } catch (err) {
            console.error('Error fetching dispatcher data:', err);
            toast.error('Error al cargar datos');
        }
    };

    const fetchCadetes = async () => {
        try {
            const data = await logisticsV2Service.getActiveCadetes();
            // Group by employee_id to avoid duplicates from multiple shifts/sessions
            const grouped = Object.values(data.reduce((acc: any, curr: any) => {
                const id = curr.employee_id;
                if (!acc[id]) {
                    acc[id] = curr;
                } else if (!acc[id].latest_location && curr.latest_location) {
                    acc[id] = curr; // Prefer the one with location
                }
                return acc;
            }, {}));

            if (grouped.length > prevCadeteCount) {
                playNotification();
            }
            setPrevCadeteCount(grouped.length);
            setCadetes(grouped as any);
        } catch (error) {
            console.error('Error fetching cadetes:', error);
        }
    };

    const fetchOrders = async () => {
        try {
            const data = await logisticsV2Service.getAvailableOrders();
            const normalized = (data || []).map(o => ({
                id: o.id,
                order_number: o.order_number,
                client_name: o.client?.name || o.chat_context?.pushName || 'Cliente',
                delivery_address: o.delivery_address || 'Retiro en Local',
                total_amount: o.total_amount,
                status: o.status,
                created_at: o.created_at
            }));
            
            setPendingOrders(normalized);
        } catch (error) {
            console.error('Error fetching orders:', error);
            throw error;
        }
    };


    const handleBulkAssign = async () => {
        if (!selectedCadete || selectedOrderIds.length === 0) return;
        
        try {
            await logisticsV2Service.assignOrdersToCadete(selectedOrderIds, selectedCadete);
            toast.success(`Misión creada con ${selectedOrderIds.length} pedidos`);
            setSelectedOrderIds([]);
            fetchOrders();
            fetchActiveMission();
        } catch (err) {
            toast.error('Error al crear la misión');
        }
    };

    const toggleOrderSelection = (id: string) => {
        setSelectedOrderIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const getVehicleIcon = (type: string) => {
        switch (type?.toUpperCase()) {
            case 'MOTO': return <Bike className="text-white" size={16} />;
            case 'AUTO': return <Car className="text-white" size={16} />;
            case 'CAMIONETA': return <Truck className="text-white" size={16} />;
            default: return <Navigation className="text-white" size={16} />;
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] bg-gray-100 overflow-hidden font-sans">
            {/* --- LEFT SIDEBAR: Orders Queue --- */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-hidden shadow-lg z-10">
                <div className="p-4 border-b border-gray-100 bg-[#f8fafc]">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-lg font-bold text-[#1e293b] flex items-center gap-2">
                            <Package className="text-blue-600" size={20} />
                            Cola de Pedidos
                        </h2>
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                            {pendingOrders.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                        <div className={`w-2 h-2 rounded-full ${
                            realtimeStatus === 'CONNECTED' ? 'bg-green-500' : 
                            realtimeStatus === 'CONNECTING' ? 'bg-yellow-500 animate-pulse' : 
                            'bg-red-500'
                        }`}></div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                            {realtimeStatus === 'CONNECTED' ? 'En Tiempo Real' : 
                             realtimeStatus === 'CONNECTING' ? 'Conectando...' : 
                             'Error de Red'}
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Pedidos listos para asignar</p>
                    {selectedOrderIds.length > 0 && (
                        <button 
                            onClick={handleBulkAssign}
                            className="w-full mt-3 py-2 bg-red-600 text-white rounded-lg text-xs font-black shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                        >
                            CREAR MISIÓN CON {selectedOrderIds.length}
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#f8fafc]">
                    {pendingOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 opacity-60">
                            <CheckCircle2 size={40} className="mb-2" />
                            <p className="text-sm font-medium">Todo al día</p>
                        </div>
                    ) : (
                        pendingOrders.map(order => {
                            const isSelected = selectedOrderIds.includes(order.id);
                            return (
                                <div key={order.id} 
                                    onClick={() => toggleOrderSelection(order.id)}
                                    className={`bg-white p-3 rounded-xl border-2 transition-all cursor-pointer group ${isSelected ? 'border-red-500 ring-2 ring-red-50' : 'border-gray-100 shadow-sm hover:border-blue-200'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-red-500 border-red-500' : 'border-gray-200'}`}>
                                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-sm"></div>}
                                            </div>
                                            <span className="text-[10px] font-mono font-bold text-gray-400">#{order.order_number}</span>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(order.status) ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {order.status === 'IN_TRANSIT' ? 'LISTO' : order.status}
                                        </span>
                                    </div>
                                    <h3 className="text-sm font-bold text-gray-800 mb-1 leading-tight">{order.client_name}</h3>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                                        <MapPin size={12} className="shrink-0" />
                                        <span className="truncate">{order.delivery_address}</span>
                                    </p>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* --- CENTRAL AREA: Map --- */}
            <div className="flex-1 relative">
                <MapContainer 
                    center={BAHIA_BLANCA} 
                    zoom={13} 
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                    />
                    
                    {cadetes.map(cadete => {
                        const loc = cadete.latest_location;
                        if (!loc) return null;
                        
                        // Custom Marker Icon
                        const markerHtml = `
                            <div class="relative">
                                <div class="w-10 h-10 rounded-full border-2 border-white shadow-xl flex items-center justify-center transform rotate-45" 
                                     style="background-color: ${cadete.station?.color || '#3b82f6'}">
                                    <div class="transform -rotate-45">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                                            <path d="M2 17l10 5 10-5"></path>
                                            <path d="M2 12l10 5 10-5"></path>
                                        </svg>
                                    </div>
                                </div>
                                <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full border-2 border-blue-500"></div>
                            </div>
                        `;
                        const customIcon = L.divIcon({
                            html: markerHtml,
                            className: '',
                            iconSize: [40, 40],
                            iconAnchor: [20, 40]
                        });

                        return (
                            <Marker 
                                key={cadete.id} 
                                position={[loc.lat, loc.lng]} 
                                icon={customIcon}
                                eventHandlers={{
                                    click: () => {
                                        setSelectedCadete(cadete.employee_id);
                                        toast.info(`Seleccionado: ${cadete.employee?.name}`);
                                    },
                                }}
                            >
                                <Popup>
                                    <div className="p-1">
                                        <p className="font-bold text-sm mb-1">{cadete.employee?.name}</p>
                                        <p className="text-xs text-gray-500 mb-2">Estación: {cadete.station?.name}</p>
                                        <button 
                                            onClick={() => setSelectedCadete(cadete.employee_id)}
                                            className="w-full bg-blue-600 text-white text-[10px] font-bold py-1 px-2 rounded hover:bg-blue-700"
                                        >
                                            SELECCIONAR PARA ASIGNAR
                                        </button>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                </MapContainer>

                {/* Map Overlay: Active Mission Details */}
                {selectedCadete && activeMission && (
                    <div className="absolute bottom-6 left-6 z-[500] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-blue-100 p-4 w-72 animate-in slide-in-from-left-5">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                                <Navigation size={16} className="text-blue-600" />
                                Misión en Curso
                            </h3>
                            <button onClick={() => setSelectedCadete(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                        </div>
                        <div className="space-y-3 max-h-48 overflow-y-auto no-scrollbar">
                            {activeMission.assignment_orders?.sort((a: any, b: any) => a.sequence_number - b.sequence_number).map((stop: any) => (
                                <div key={stop.id} className={`flex items-start gap-2 ${stop.status === 'COMPLETED' ? 'opacity-40' : ''}`}>
                                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${stop.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`}></div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-bold text-gray-700 leading-tight">
                                            {stop.action_type === 'PICKUP' ? 'Retiro en Local' : `Entrega #${stop.order?.id?.slice(-4).toUpperCase()}`}
                                        </p>
                                        <p className="text-[9px] text-gray-400 truncate">{stop.order?.delivery_address || 'Bahía Blanca'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Map Overlay: Floating Legend */}
                <div className="absolute top-4 right-4 z-[500] bg-white/90 backdrop-blur rounded-xl shadow-lg border border-gray-200 p-3 w-64 px-4 overflow-hidden">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Users size={14} />
                        Cadetes Activos
                    </h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
                        {cadetes.length === 0 ? (
                            <p className="text-xs text-center py-4 text-gray-400 italic">No hay repartidores en línea</p>
                        ) : (
                            cadetes.map(cadete => (
                                <div 
                                    key={cadete.id}
                                    onClick={() => setSelectedCadete(cadete.employee_id)}
                                    className={`flex items-center gap-3 cursor-pointer group transition-all p-2 rounded-lg ${selectedCadete === cadete.employee_id ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}
                                >
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: cadete.station?.color || '#3b82f6' }}>
                                        {getVehicleIcon(cadete.metadata?.vehicle_type || '')}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-gray-800 truncate">{cadete.employee?.name}</p>
                                        <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${cadete.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
                                            {cadete.is_online ? 'En línea' : 'Desconectado'}
                                        </p>
                                    </div>
                                    <MoreVertical size={14} className="text-gray-300 group-hover:text-gray-600" />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dispatcher;
