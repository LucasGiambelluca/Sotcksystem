import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Circle, Polygon, useMapEvents, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Shield, ShieldOff, Save, Trash2, Plus, Search } from 'lucide-react';
import type { ShippingZone } from '../types';
import neighborhoodData from '../data/bahia-neighborhoods.json';

// Fix for default marker icons in Leaflet with React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface ShippingMapProps {
    storeLoc: { lat: number; lng: number };
    zones: ShippingZone[];
    onUpdateZone: (id: string, updates: Partial<ShippingZone>) => void;
    onAddZone: (zone: Partial<ShippingZone>) => void;
    onDeleteZone: (id: string) => void;
}

type NeighborhoodFeature = {
    type: string;
    properties: { name: string };
    geometry: { type: string; coordinates: number[][][] };
};

export default function ShippingMap({ storeLoc, zones, onUpdateZone, onAddZone, onDeleteZone }: ShippingMapProps) {
    const [drawingPolygon, setDrawingPolygon] = useState<[number, number][]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawingType, setDrawingType] = useState<'delivery' | 'danger'>('delivery');
    const [mapCenter] = useState<[number, number]>([storeLoc.lat || -38.7183, storeLoc.lng || -62.2663]);

    const [filterText, setFilterText] = useState('');

    const radiusZone = zones.find(z => z.zone_type === 'radius' && z.is_active);
    const currentRadiusKm = radiusZone?.max_radius_km || 5;

    // Build a lookup: neighborhood name -> saved zone
    const zoneByName = useMemo(() => {
        const map = new Map<string, ShippingZone>();
        for (const z of zones) {
            if (z.zone_type === 'polygon' && z.name) {
                map.set(z.name.toUpperCase().trim(), z);
            }
        }
        return map;
    }, [zones]);

    // Get the list of neighborhoods from GeoJSON, filtered by search
    const neighborhoods = useMemo(() => {
        const features = (neighborhoodData as any).features as NeighborhoodFeature[];
        if (!filterText.trim()) return features;
        const q = filterText.toUpperCase().trim();
        return features.filter(f => f.properties.name.toUpperCase().includes(q));
    }, [filterText]);

    // Stats
    const stats = useMemo(() => {
        let green = 0, red = 0, gray = 0;
        const allFeatures = (neighborhoodData as any).features as NeighborhoodFeature[];
        for (const f of allFeatures) {
            const zone = zoneByName.get(f.properties.name.toUpperCase().trim());
            if (!zone) { gray++; continue; }
            if (zone.allow_delivery) green++;
            else red++;
        }
        return { green, red, gray, total: allFeatures.length };
    }, [zoneByName]);



    const handleNeighborhoodClick = (feature: NeighborhoodFeature, action: 'green' | 'red' | 'remove') => {
        const name = feature.properties.name;
        const existingZone = zoneByName.get(name.toUpperCase().trim());

        if (action === 'remove') {
            if (existingZone) onDeleteZone(String(existingZone.id));
            return;
        }

        if (existingZone) {
            // Update existing zone
            onUpdateZone(String(existingZone.id), { allow_delivery: action === 'green' });
        } else {
            // Create new zone from the neighborhood geometry
            onAddZone({
                name: name,
                zone_type: 'polygon',
                polygon: feature.geometry,
                allow_delivery: action === 'green',
                cost: 0
            });
        }
    };

    const getNeighborhoodStyle = (feature: NeighborhoodFeature) => {
        const zone = zoneByName.get(feature.properties.name.toUpperCase().trim());
        if (!zone) {
            // Gray - unconfigured
            return { color: '#6b7280', fillColor: '#9ca3af', fillOpacity: 0.15, weight: 1.5 };
        }
        if (zone.allow_delivery) {
            // Green - allowed
            return { color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.35, weight: 2 };
        }
        // Red - blocked
        return { color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.4, weight: 2 };
    };

    const MapEvents = () => {
        useMapEvents({
            click(e) {
                if (isDrawing) {
                    setDrawingPolygon([...drawingPolygon, [e.latlng.lat, e.latlng.lng]]);
                }
            },
        });
        return null;
    };

    const removePoint = (index: number) => {
        setDrawingPolygon(drawingPolygon.filter((_, i) => i !== index));
    };

    const finishPolygon = () => {
        if (drawingPolygon.length < 3) return alert('El polígono debe tener al menos 3 puntos');
        const geojson = {
            type: 'Polygon',
            coordinates: [[...drawingPolygon.map(p => [p[1], p[0]]), [drawingPolygon[0][1], drawingPolygon[0][0]]]]
        };
        onAddZone({
            name: drawingType === 'delivery' ? 'Zona Permitida' : 'Barrio Peligroso',
            zone_type: 'polygon',
            polygon: geojson,
            allow_delivery: drawingType === 'delivery',
            cost: 0
        });
        setDrawingPolygon([]);
        setIsDrawing(false);
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b flex flex-wrap justify-between items-center bg-gray-50 gap-4">
                <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <MapPin className="text-blue-600" size={18} />
                        Mapa de Barrios — Modo Rompecabezas 🧩
                    </h3>
                    <p className="text-xs text-gray-500">Hacé click en un barrio para habilitar o bloquear entregas</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Filter bar for neighborhoods */}
                    {!isDrawing && (
                        <div className="flex bg-white border rounded-lg shadow-sm overflow-hidden">
                            <div className="flex items-center px-3 text-gray-400 border-r bg-gray-50">
                                <Search size={16} />
                            </div>
                            <input 
                                type="text"
                                placeholder="Filtrar barrios..."
                                className="px-3 py-2 text-sm focus:outline-none w-48"
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                            />
                        </div>
                    )}

                    {isDrawing && (
                         <div className="flex bg-white border rounded-lg overflow-hidden p-1 shadow-sm">
                            <button 
                                onClick={() => setDrawingType('delivery')}
                                className={`px-3 py-1 text-xs font-bold rounded ${drawingType === 'delivery' ? 'bg-green-100 text-green-700' : 'text-gray-400'}`}
                            >
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500" /> Permitido
                                </div>
                            </button>
                            <button 
                                onClick={() => setDrawingType('danger')}
                                className={`px-3 py-1 text-xs font-bold rounded ${drawingType === 'danger' ? 'bg-red-100 text-red-700' : 'text-gray-400'}`}
                            >
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-red-500" /> Peligroso
                                </div>
                            </button>
                         </div>
                    )}

                    <div className="flex gap-2">
                        {!isDrawing ? (
                            <button 
                                onClick={() => setIsDrawing(true)}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center gap-2 shadow-sm transition"
                            >
                                <Plus size={18} /> Dibujar Personalizado
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button 
                                    onClick={finishPolygon}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 flex items-center gap-2 shadow-sm transition"
                                >
                                    <Save size={18} /> Guardar
                                </button>
                                <button 
                                    onClick={() => { setIsDrawing(false); setDrawingPolygon([]); }}
                                    className="bg-white text-gray-600 border px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition"
                                >
                                    Cancelar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="px-4 py-2 bg-gradient-to-r from-gray-50 to-white border-b flex items-center gap-4 text-xs font-semibold">
                <span className="text-gray-500">🧩 {stats.total} barrios</span>
                <span className="text-green-600">✅ {stats.green} habilitados</span>
                <span className="text-red-600">🚫 {stats.red} bloqueados</span>
                <span className="text-gray-400">⬜ {stats.gray} sin configurar</span>
                {filterText && <span className="text-blue-600 ml-auto">Mostrando {neighborhoods.length} de {stats.total}</span>}
            </div>

            {/* Map */}
            <div className="flex-1 relative min-h-[550px]">
                <MapContainer 
                    center={mapCenter} 
                    zoom={13} 
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap'
                    />
                    <MapEvents />

                    {/* Store Marker */}
                    <Marker position={[storeLoc.lat, storeLoc.lng]}>
                        <Popup>
                            <strong>Tu Local (Origen)</strong>
                        </Popup>
                    </Marker>

                    {/* Delivery Radius */}
                    <Circle 
                        center={[storeLoc.lat, storeLoc.lng]}
                        radius={currentRadiusKm * 1000}
                        pathOptions={{ 
                            color: '#3b82f6', 
                            fillColor: '#3b82f6', 
                            fillOpacity: 0.05,
                            weight: 2,
                            dashArray: '10, 10'
                        }}
                    />

                    {/* 🧩 PUZZLE PIECES - All neighborhoods */}
                    {neighborhoods.map((feature, idx) => {
                        const positions = feature.geometry.coordinates[0].map((c: any) => [c[1], c[0]] as [number, number]);
                        const style = getNeighborhoodStyle(feature);
                        const zone = zoneByName.get(feature.properties.name.toUpperCase().trim());
                        const status = !zone ? 'gray' : zone.allow_delivery ? 'green' : 'red';

                        return (
                            <Polygon
                                key={`puzzle-${idx}`}
                                positions={positions}
                                pathOptions={style}
                            >
                                <Popup>
                                    <div className="p-2 min-w-[180px]">
                                        <p className="font-bold text-sm mb-1 text-gray-800">{feature.properties.name}</p>
                                        <p className="text-[10px] text-gray-400 mb-2 uppercase font-bold">
                                            {status === 'gray' ? '⬜ Sin configurar' : status === 'green' ? '✅ Habilitado' : '🚫 Bloqueado'}
                                        </p>
                                        <div className="space-y-1.5">
                                            <button
                                                onClick={() => handleNeighborhoodClick(feature, 'green')}
                                                className={`w-full flex items-center justify-center gap-2 text-xs py-2 rounded font-bold transition ${
                                                    status === 'green' ? 'bg-green-200 text-green-800 ring-2 ring-green-500' : 'bg-green-50 text-green-700 hover:bg-green-100'
                                                }`}
                                            >
                                                <Shield size={13} /> Habilitar Envío
                                            </button>
                                            <button
                                                onClick={() => handleNeighborhoodClick(feature, 'red')}
                                                className={`w-full flex items-center justify-center gap-2 text-xs py-2 rounded font-bold transition ${
                                                    status === 'red' ? 'bg-red-200 text-red-800 ring-2 ring-red-500' : 'bg-red-50 text-red-700 hover:bg-red-100'
                                                }`}
                                            >
                                                <ShieldOff size={13} /> Bloquear Envío
                                            </button>
                                            {status !== 'gray' && (
                                                <button
                                                    onClick={() => handleNeighborhoodClick(feature, 'remove')}
                                                    className="w-full text-gray-500 text-xs py-1 flex items-center justify-center gap-1 hover:bg-gray-100 rounded"
                                                >
                                                    <Trash2 size={13} /> Quitar configuración
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                            </Polygon>
                        );
                    })}

                    {/* Custom saved zones (non-puzzle, e.g. from Nominatim or manual drawing) */}
                    {zones.filter(z => {
                        if (z.zone_type !== 'polygon' || !z.polygon) return false;
                        // Skip zones that are already rendered as puzzle pieces
                        const allNames = new Set((neighborhoodData as any).features.map((f: any) => f.properties.name.toUpperCase().trim()));
                        return !allNames.has((z.name || '').toUpperCase().trim());
                    }).map(zone => {
                        const geojson = zone.polygon;
                        if (!geojson || !geojson.coordinates) return null;
                        const polygonParts = geojson.type === 'MultiPolygon' ? geojson.coordinates : [geojson.coordinates];
                        return polygonParts.map((part: any, partIdx: number) => {
                            const positions = part[0].map((c: any) => [c[1], c[0]]);
                            return (
                                <Polygon 
                                    key={`custom-${zone.id}-${partIdx}`}
                                    positions={positions}
                                    pathOptions={{ 
                                        color: zone.allow_delivery ? '#22c55e' : '#ef4444',
                                        fillColor: zone.allow_delivery ? '#22c55e' : '#ef4444',
                                        fillOpacity: 0.4,
                                        weight: 2
                                    }}
                                >
                                    <Popup>
                                        <div className="p-2 min-w-[150px]">
                                            <div className="mb-2">
                                                <label className="text-[10px] text-gray-500 font-bold uppercase">Nombre</label>
                                                <input 
                                                    className="font-bold text-sm w-full border rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-500"
                                                    defaultValue={zone.name}
                                                    onBlur={(e) => onUpdateZone(String(zone.id), { name: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <button 
                                                    onClick={() => onUpdateZone(String(zone.id), { allow_delivery: !zone.allow_delivery })}
                                                    className={`w-full flex items-center justify-center gap-2 text-xs py-2 rounded font-bold transition ${zone.allow_delivery ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                                                >
                                                    {zone.allow_delivery ? <Shield size={14} /> : <ShieldOff size={14} />}
                                                    {zone.allow_delivery ? 'PERMITIDO' : 'PROHIBIDO'}
                                                </button>
                                                <button 
                                                    onClick={() => onDeleteZone(String(zone.id))}
                                                    className="w-full text-red-500 text-xs py-1 flex items-center justify-center gap-1 hover:bg-red-50 rounded"
                                                >
                                                    <Trash2 size={14} /> Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    </Popup>
                                </Polygon>
                            );
                        });
                    })}

                    {/* Drawing Preview */}
                    {isDrawing && (
                        <>
                            {drawingPolygon.map((p, i) => (
                                <Marker 
                                    key={i} 
                                    position={p} 
                                    eventHandlers={{
                                        click: () => removePoint(i)
                                    }}
                                    icon={L.divIcon({ 
                                        className: 'drawing-point',
                                        html: `<div style="background: #3b82f6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>` 
                                    })} 
                                />
                            ))}
                            {drawingPolygon.length > 2 && (
                                <Polygon 
                                    positions={drawingPolygon} 
                                    pathOptions={{ 
                                        color: drawingType === 'delivery' ? '#22c55e' : '#ef4444', 
                                        fillColor: drawingType === 'delivery' ? '#22c55e' : '#ef4444',
                                        fillOpacity: 0.3,
                                        dashArray: '5, 5' 
                                    }} 
                                />
                            )}
                            {drawingPolygon.length > 1 && drawingPolygon.length <= 2 && (
                                <Polygon positions={drawingPolygon} pathOptions={{ color: '#3b82f6', weight: 2 }} />
                            )}
                        </>
                    )}
                </MapContainer>
                
                {isDrawing && (
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[1000] space-y-2 text-center pointer-events-none">
                        <div className="bg-white px-6 py-2 rounded-full shadow-xl border-2 border-blue-500 pointer-events-auto">
                             <p className="text-sm font-bold text-blue-700">
                                {drawingPolygon.length === 0 ? 'Hacé click para el primer punto' : 
                                 drawingPolygon.length < 3 ? 'Necesitás al menos 3 puntos' : 
                                 '¡Podés seguir sumando puntos o Guardar!'}
                             </p>
                        </div>
                        <p className="text-[10px] bg-black bg-opacity-50 text-white px-2 py-0.5 rounded inline-block">TIP: Hacé click en un punto azul para borrarlo</p>
                    </div>
                )}
            </div>

            {/* Bottom Legend */}
            <div className="p-4 bg-gray-50 border-t flex flex-wrap gap-6 text-xs font-semibold text-gray-600 justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500 bg-opacity-40 border-2 border-green-500"></div>
                    <span>Habilitado: Se entrega</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500 bg-opacity-40 border-2 border-red-500"></div>
                    <span>Bloqueado: Sin delivery</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-gray-400 bg-opacity-20 border-2 border-gray-400"></div>
                    <span>Sin configurar: Usa radio general</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-dashed"></div>
                    <span>Radio Máximo ({currentRadiusKm} km)</span>
                </div>
            </div>
        </div>
    );
}
