
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, RefreshCw, Navigation, Truck } from 'lucide-react';
import L from 'leaflet';

// Icons fix for Leaflet in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons
const warehouseIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/447/447031.png', // Placeholder
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [1, -34],
});

const deliveryIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png', // Placeholder
    iconSize: [30, 30],
    iconAnchor: [15, 30]
});

interface RouteStop {
    id: string; // route_order_id
    order_id: string;
    sequence_number: number;
    formatted_address: string;
    delivery_lat: number;
    delivery_lng: number;
    status: string;
    order: {
        id: string;
        client: {
            name: string;
            phone: string;
            address?: string; // Client default address
        };
        delivery_address?: string;
    };
}

interface RouteData {
    id: string;
    name: string;
    status: string;
    start_lat: number;
    start_lng: number;
    start_address: string;
    total_distance_km: number;
    estimated_duration_min: number;
}

// Sortable Item Component
function SortableStop({ stop, index }: { stop: RouteStop; index: number }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: stop.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} 
             className="bg-white p-3 mb-2 rounded shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md cursor-grab active:cursor-grabbing">
            <div className="flex items-center gap-3">
                <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                    {index + 1}
                </div>
                <div>
                    <h4 className="font-medium text-gray-800 text-sm">{stop.order.client?.name || 'Cliente'}</h4>
                    <p className="text-xs text-gray-500 truncate max-w-[180px]">
                        {stop.formatted_address || stop.order?.delivery_address || stop.order?.client?.address || 'Sin dirección'}
                    </p>
                </div>
            </div>
            <div className="text-gray-400">
                ⋮⋮
            </div>
        </div>
    );
}

// Map Component to handle updates
function MapUpdater({ center, stops }: { center: [number, number], stops: RouteStop[] }) {
    const map = useMap();
    
    useEffect(() => {
        if (stops.length > 0) {
            const bounds = L.latLngBounds([center]);
            stops.forEach(stop => {
                if (stop.delivery_lat && stop.delivery_lng) {
                    bounds.extend([stop.delivery_lat, stop.delivery_lng]);
                }
            });
            map.fitBounds(bounds, { padding: [50, 50] });
        } else {
            map.setView(center, 13);
        }
    }, [center, stops, map]);
    
    return null;
}

export default function RoutePlanner() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [route, setRoute] = useState<RouteData | null>(null);
    const [stops, setStops] = useState<RouteStop[]>([]);
    const [loading, setLoading] = useState(true);
    const [optimizing, setOptimizing] = useState(false);
    const [optimizationMetrics, setOptimizationMetrics] = useState<any>(null); // { improvementPercent, fuelSavings, algorithm }

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchRouteData();
    }, [id]);

    const fetchRouteData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            // Fetch Route
            const { data: routeData, error: routeError } = await supabase
                .from('routes')
                .select('*')
                .eq('id', id)
                .single();
            
            if (routeError) throw routeError;
            setRoute(routeData);

            // Fetch Stops
            const { data: stopsData, error: stopsError } = await supabase
                .from('route_orders')
                .select(`
                    *,
                    order:orders (
                        id,
                        delivery_address, 
                        client:clients (name, phone, address)
                    )
                `)
                .eq('route_id', id)
                .order('sequence_number', { ascending: true });

            if (stopsError) throw stopsError;
            setStops(stopsData || []);

        } catch (error: any) {
            console.error('Error fetching route:', error);
            toast.error('Error al cargar la ruta');
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setStops((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Update Sequence in Backend
                saveSequence(newItems);

                return newItems;
            });
        }
    };

    const saveSequence = async (newStops: RouteStop[]) => {
        const updates = newStops.map((stop, index) => ({
            route_order_id: stop.id,
            sequence_number: index + 1
        }));

        try {
            // Call API
            const response = await fetch(`http://localhost:3001/api/logistics/routes/${id}/sequence`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_sequence: updates })
            });
            
            if (!response.ok) throw new Error('API Sync Failed');
            
            // Optional: Recalculate metrics here or rely on Optimistic UI
            
        } catch (error) {
            console.error('Failed to save sequence:', error);
            toast.error('Error al guardar el orden');
            fetchRouteData(); // Revert on error
        }
    };

    const [optimizationStrategy, setOptimizationStrategy] = useState('nearest_first');

    const handleOptimize = async () => {
        setOptimizing(true);
        setOptimizationMetrics(null);
        try {
            const response = await fetch(`http://localhost:3001/api/logistics/routes/${id}/optimize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategy: optimizationStrategy })
            });

            if (!response.ok) throw new Error('Optimization Failed');

            const result = await response.json();
            
            if (result.metrics) {
                setOptimizationMetrics(result.metrics);
            }

            await fetchRouteData(); // Reload all data
            toast.success('Ruta optimizada con éxito');

        } catch (error) {
            console.error('Optimization error:', error);
            toast.error('Error al optimizar ruta');
        } finally {
            setOptimizing(false);
        }
    };

    const [showShareModal, setShowShareModal] = useState(false);
    const [driverPhone, setDriverPhone] = useState('');
    const [sharing, setSharing] = useState(false);

    const handleGetNavigation = async () => {
        try {
            const response = await fetch(`http://localhost:3001/api/logistics/routes/${id}/navigation-url`);
            const data = await response.json();
            
            if (data.primary_url) {
                window.open(data.primary_url, '_blank');
            } else {
                toast.error('No se pudo generar la URL');
            }
        } catch (error) {
            console.error('Navigation error:', error);
            toast.error('Error al abrir navegación');
        }
    };

    const handleShareRoute = async () => {
        setSharing(true);
        try {
            const response = await fetch(`http://localhost:3001/api/logistics/routes/${id}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: driverPhone })
            });

            if (!response.ok) throw new Error('Share Failed');

            toast.success('Ruta enviada al chofer');
            setShowShareModal(false);
            setDriverPhone('');
        } catch (error) {
            console.error('Share error:', error);
            toast.error('Error al compartir ruta');
        } finally {
            setSharing(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin" /></div>;
    if (!route) return <div className="p-8">Ruta no encontrada</div>;

    // Default to Bahia Blanca: -38.7183177, -62.2663478
    const startLocation: [number, number] = [
        route.start_lat || -38.7183177, 
        route.start_lng || -62.2663478
    ];

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            {route.name}
                            <span className={`px-2 py-0.5 text-xs rounded-full ${route.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {route.status}
                            </span>
                        </h1>
                        <p className="text-sm text-gray-500">
                            {stops.length} paradas • {route.total_distance_km ? `${route.total_distance_km.toFixed(1)} km` : 'Sin calculo'} • {route.estimated_duration_min ? `${Math.round(route.estimated_duration_min / 60)}h ${route.estimated_duration_min % 60}m` : ''}
                        </p>
                        {optimizationMetrics && (
                             <div className="mt-2 text-sm flex gap-3 text-green-700 font-medium bg-green-50 px-3 py-1 rounded-md inline-flex border border-green-200">
                                <span>🚀 {optimizationMetrics.algorithm}</span>
                                <span>📉 -{optimizationMetrics.improvementPercent}% Distancia</span>
                                <span>⛽ Ahorro: {optimizationMetrics.fuelSavings}</span>
                             </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <select 
                        value={optimizationStrategy}
                        onChange={(e) => setOptimizationStrategy(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm bg-white text-gray-700 shadow-sm"
                    >
                        <option value="nearest_first">Más cercano primero</option>
                        <option value="farthest_first">Más lejano primero</option>
                    </select>
                    <button 
                        onClick={handleOptimize}
                        disabled={optimizing || route.status !== 'DRAFT'}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {optimizing ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                        Optimizar Ruta
                    </button>
                    <button 
                        onClick={handleGetNavigation}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <Navigation size={18} />
                        Navegar
                    </button>
                     <button 
                        onClick={() => setShowShareModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                    >
                        <Truck size={18} />
                        Enviar al Chofer
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar List */}
                <div className="w-[30%] min-w-[320px] bg-white border-r overflow-y-auto p-4 max-h-screen">
                    {/* Start Point */}
                    <div className="bg-gray-50 p-3 mb-4 rounded border border-gray-200 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center">
                            <Truck size={14} />
                        </div>
                        <div>
                            <p className="font-bold text-sm">Inicio: {route.start_address || 'Depósito Central'}</p>
                            <p className="text-xs text-gray-500">Salida</p>
                        </div>
                    </div>
                
                    <div className="mb-2">
                        <h3 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wider">Paradas ({stops.length})</h3>
                        <DndContext 
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext 
                                items={stops.map(s => s.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {stops.map((stop, index) => (
                                    <SortableStop key={stop.id} stop={stop} index={index} />
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>

                {/* Map View */}
                <div className="flex-1 relative z-0">
                    <MapContainer 
                        center={startLocation} 
                        zoom={13} 
                        className="h-full w-full"
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        
                        <MapUpdater center={startLocation} stops={stops} />

                        {/* Start Marker */}
                        <Marker position={startLocation} icon={warehouseIcon}>
                            <Popup>Inicio: {route.start_address}</Popup>
                        </Marker>

                        {/* Stop Markers */}
                        {stops.map((stop, index) => (
                            stop.delivery_lat && stop.delivery_lng ? (
                                <Marker 
                                    key={stop.id} 
                                    position={[stop.delivery_lat, stop.delivery_lng]}
                                    icon={deliveryIcon}
                                >
                                    <Popup>
                                        <b>#{index + 1} - {stop.order.client?.name}</b><br/>
                                        {stop.formatted_address}
                                    </Popup>
                                </Marker>
                            ) : null
                        ))}

                        {/* Route Line (Simple Polyline connecting sequence) */}
                        <Polyline 
                            positions={[
                                startLocation,
                                ...stops
                                    .filter(s => s.delivery_lat && s.delivery_lng)
                                    .map(s => [s.delivery_lat, s.delivery_lng] as [number, number])
                            ]}
                            color="blue"
                            dashArray="10, 10" 
                            opacity={0.6}
                        />
                    </MapContainer>
                </div>
            </div>

            {/* Share Modal */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
                        <h2 className="text-lg font-bold mb-4">Enviar Ruta al Chofer</h2>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (WhatsApp)</label>
                            <input 
                                type="text" 
                                placeholder="Ej: 549291..." 
                                className="w-full border rounded px-3 py-2"
                                value={driverPhone}
                                onChange={(e) => setDriverPhone(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">Ingresa el número con código de país (sin +)</p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => setShowShareModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleShareRoute}
                                disabled={sharing || !driverPhone}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                                {sharing ? 'Enviando...' : 'Enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
