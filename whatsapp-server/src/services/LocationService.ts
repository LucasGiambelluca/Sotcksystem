

export interface LatLng {
    lat: number;
    lng: number;
}


export interface ShippingZone {
    id: string;
    name: string;
    zone_type: 'radius' | 'polygon';
    max_radius_km: number | null;
    polygon: any | null; // GeoJSON Polygon
    allow_delivery: boolean;
    cost: number;
    is_active: boolean;
}

export class LocationService {
    /**
     * Determina si un punto está dentro de un GeoJSON Polygon o MultiPolygon.
     */
    public static isPointInPolygon(point: LatLng, geojson: any): boolean {
        if (!geojson || !geojson.type || !geojson.coordinates) return false;

        const checkRing = (coords: number[][]): boolean => {
            let inside = false;
            for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
                const xi = coords[i][1], yi = coords[i][0];
                const xj = coords[j][1], yj = coords[j][0];
                
                const intersect = ((yi > point.lng) !== (yj > point.lng))
                    && (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };

        if (geojson.type === 'Polygon') {
            // Un Polígono tiene múltiples anillos (el primero es el exterior)
            // Para simplificar, chequeamos si está en el exterior (asumimos no está en huecos por ahora)
            return checkRing(geojson.coordinates[0]);
        } 
        
        if (geojson.type === 'MultiPolygon') {
            // Un MultiPolígono tiene múltiples Polígonos
            return geojson.coordinates.some((polygonCoords: any) => checkRing(polygonCoords[0]));
        }

        return false;
    }

    private static calculateHaversineDistance(point1: LatLng, point2: LatLng): number {
        const R = 6371;
        const dLat = this.deg2rad(point2.lat - point1.lat);
        const dLng = this.deg2rad(point2.lng - point1.lng);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(point1.lat)) * Math.cos(this.deg2rad(point2.lat)) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    private static deg2rad(deg: number): number {
        return deg * (Math.PI/180);
    }

    public static calculateRoutingDistance(point1: LatLng, point2: LatLng, multiplier: number = 1.3): number {
        const linearDistance = this.calculateHaversineDistance(point1, point2);
        return linearDistance * multiplier;
    }

    /**
     * Determina si una ubicación es válida para envío y calcula su costo.
     * Prioriza Zonas Prohibidas (Rojo) sobre Zonas Permitidas (Verde).
     */
    public static async determineShippingZone(
        zones: ShippingZone[], 
        clientLocation?: LatLng, 
        storeLocation?: LatLng,
        address?: string | null
    ): Promise<{ zone: ShippingZone | null, distance_km: number | null, allowed: boolean, error?: string }> {
        
        const activeZones = zones.filter(z => z.is_active);
        
        if (!clientLocation) {
            if (address && address.length > 5) {
                try {
                    // Geocode address via Nominatim (free OSM API)
                    const axios = require('axios');
                    const query = encodeURIComponent(`${address}, Bahia Blanca, Argentina`);
                    const { data: results } = await axios.get(
                        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
                        { headers: { 'User-Agent': 'StockSystem/1.0' }, timeout: 5000 }
                    );
                    if (results && results.length > 0) {
                        clientLocation = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
                    }
                } catch (e) {
                    console.error('[LocationService] Geocoding fallback failed:', e);
                }
            }

            if (!clientLocation) {
                return { zone: null, distance_km: null, allowed: false, error: 'No se pudo determinar la ubicación (GPS o Texto).' };
            }
        }

        // 1. CHEQUEO DE ZONAS PROHIBIDAS (Rojo) - Máxima prioridad
        const forbiddenZones = activeZones.filter(z => !z.allow_delivery);
        for (const zone of forbiddenZones) {
            if (zone.zone_type === 'polygon' && this.isPointInPolygon(clientLocation, zone.polygon)) {
                return { zone, distance_km: null, allowed: false, error: `Lo sentimos, no realizamos envíos a la zona de ${zone.name} por razones de seguridad.` };
            }
            if (zone.zone_type === 'radius' && storeLocation && zone.max_radius_km) {
                const dist = this.calculateHaversineDistance(storeLocation, clientLocation);
                if (dist <= zone.max_radius_km) {
                    return { zone, distance_km: dist, allowed: false, error: `La zona ${zone.name} está excluida de repartos.` };
                }
            }
        }

        // 2. CHEQUEO DE ZONAS PERMITIDAS (Verde)
        let distanceKm = null;
        let eligibleZones: ShippingZone[] = [];
        const allowedZones = activeZones.filter(z => z.allow_delivery);

        for (const zone of allowedZones) {
            // Caso Polígono
            if (zone.zone_type === 'polygon' && this.isPointInPolygon(clientLocation, zone.polygon)) {
                eligibleZones.push(zone);
                continue;
            }

            // Caso Radio
            if (zone.zone_type === 'radius' && storeLocation && zone.max_radius_km) {
                distanceKm = this.calculateHaversineDistance(storeLocation, clientLocation);
                if (distanceKm <= zone.max_radius_km) {
                    eligibleZones.push(zone);
                }
            }
        }

        if (eligibleZones.length === 0) {
            return { 
                zone: null, 
                distance_km: distanceKm,
                allowed: false,
                error: distanceKm 
                    ? `Estás a ${distanceKm.toFixed(1)}km, fuera de nuestro radio de entrega.`
                    : 'Tu ubicación no coincide con ninguna zona de envío habilitada.'
            };
        }

        // Devolver la zona más barata aplicable
        eligibleZones.sort((a, b) => a.cost - b.cost);
        return { zone: eligibleZones[0], distance_km: distanceKm, allowed: true };
    }
}

