import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in React Leaflet
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const StartIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const StopIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface RouteMapProps {
  startAddress?: string;
  stops: {
    id: string;
    address: string;
    label: string;
    sequence: number;
    phone?: string;
  }[];
}

interface GeocodedPoint {
  lat: number;
  lng: number;
  address: string;
  type: 'start' | 'stop';
  label: string;
  sequence?: number;
  phone?: string;
}

function MapBounds({ points }: { points: GeocodedPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [points, map]);
  return null;
}

export default function RouteMap({ startAddress, stops }: RouteMapProps) {
  const [points, setPoints] = useState<GeocodedPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    geocodeAll();
  }, [startAddress, stops]);

  const geocodeAll = async () => {
    setLoading(true);
    const newPoints: GeocodedPoint[] = [];

    const geocode = async (address: string): Promise<{ lat: number; lng: number } | null> => {
      // 1. Construct Query first to check cache with context
      let query = address;
      const defaultRegion = localStorage.getItem('stock_app_default_region');
      
      // Only append region if not already present
      if (defaultRegion && !address.toLowerCase().includes(defaultRegion.split(',')[0].trim().toLowerCase())) {
          query = `${address}, ${defaultRegion}`;
      }
      
      const cacheKey = `geo:${query.toLowerCase().trim()}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);

      try {
        // Simple delay to respect Nominatim usage policy (1s approx)
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
             headers: { 'User-Agent': 'StockSystem/1.0' }
        });
        const data = await res.json();
        if (data && data.length > 0) {
          const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          localStorage.setItem(cacheKey, JSON.stringify(result));
          return result;
        }
      } catch (e) {
        console.error('Geocoding error', e);
      }
      return null;
    };

    if (startAddress) {
      const coords = await geocode(startAddress);
      if (coords) newPoints.push({ ...coords, address: startAddress, type: 'start', label: 'Origen' });
    }

    // Process sequentially
    for (const stop of stops) {
      if (!stop.address) continue;
      const coords = await geocode(stop.address);
      if (coords) {
         newPoints.push({
             ...coords, 
             address: stop.address, 
             type: 'stop', 
             label: stop.label, 
             sequence: stop.sequence,
             phone: stop.phone
         });
      }
    }
    setPoints(newPoints);
    setLoading(false);
  };

  if (loading && points.length === 0) {
    return (
      <div className="h-full w-full bg-gray-50 flex flex-col items-center justify-center text-gray-500 gap-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p>Buscando coordenadas...</p>
      </div>
    );
  }

  if (points.length === 0) {
     return (
      <div className="h-full w-full bg-gray-50 flex items-center justify-center text-gray-400 p-4 text-center">
        <p>Agrega direcciones válidas para ver el mapa.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer 
        center={[points[0].lat, points[0].lng]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBounds points={points} />
        
        {points.map((p, idx) => (
           <Marker 
             key={idx} 
             position={[p.lat, p.lng]} 
             icon={p.type === 'start' ? StartIcon : StopIcon}
           >
             <Popup>
               <div className="min-w-[150px]">
                 <strong className="block text-sm mb-1">{p.label}</strong>
                 <p className="text-xs text-gray-600 mb-1">{p.address}</p>
                 {p.phone && <p className="text-xs text-blue-600">📱 {p.phone}</p>}
                 {p.sequence && <span className="inline-block bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded mt-1">Parada #{p.sequence}</span>}
               </div>
             </Popup>
           </Marker>
        ))}

        <Polyline positions={points.map(p => [p.lat, p.lng])} color="#3b82f6" weight={4} opacity={0.7} />
      </MapContainer>
    </div>
  );
}
