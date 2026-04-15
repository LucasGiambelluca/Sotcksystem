
import { logger } from '../utils/logger';

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
            if (address && address.length > 3) {
                try {
                    // Normalización básica: "cramer333" -> "cramer 333"
                    const normalizedAddress = address.replace(/([a-zA-Z])(\d)/g, '$1 $2');
                    
                    const { GeocodingService } = require('./GeocodingService');
                    const geo = await GeocodingService.geocode(normalizedAddress, 'Bahia Blanca, Argentina');
                    
                    if (geo) {
                        clientLocation = { lat: geo.lat, lng: geo.lng };
                        logger.info(`[LocationService] Geocodificado "${normalizedAddress}" a ${geo.lat}, ${geo.lng} (Google)`);
                    }
                } catch (e: any) {
                    logger.error(`[LocationService] Geocoding (Google) failed: ${e.message}`);
                }
            }

            if (!clientLocation) {
                return { zone: null, distance_km: null, allowed: false, error: 'No se pudo determinar la ubicación de la dirección.' };
            }
        }

        // 1. CHEQUEO DE ZONAS PROHIBIDAS (Rojo) - Máxima prioridad
        const forbiddenZones = activeZones.filter(z => !z.allow_delivery);
        for (const zone of forbiddenZones) {
            if (zone.zone_type === 'polygon' && this.isPointInPolygon(clientLocation, zone.polygon)) {
                return { zone, distance_km: null, allowed: false, error: `Lamentablemente no llegamos con el delivery a la zona de ${zone.name}, pero ¡no te quedes con las ganas! Podés pedirlo para retirar por el local.` };
            }
            if (zone.zone_type === 'radius' && storeLocation && zone.max_radius_km) {
                const dist = this.calculateHaversineDistance(storeLocation, clientLocation);
                if (dist <= zone.max_radius_km) {
                    return { zone, distance_km: dist, allowed: false, error: `Por el momento no cubrimos repartos en ${zone.name}, pero podés realizar tu pedido para retirar por el local.` };
                }
            }
        }

        // 2. CHEQUEO DE ZONAS PERMITIDAS (Verde)
        let distanceKm = null;
        if (clientLocation && storeLocation) {
            distanceKm = this.calculateHaversineDistance(storeLocation, clientLocation);
            logger.info(`[LocationService] Distancia calculada: ${distanceKm.toFixed(2)} km`);
        } else if (!storeLocation) {
            logger.warn('[LocationService] Ubicación del local no configurada (storeLocation is null).');
        }

        let eligibleZones: ShippingZone[] = [];
        const allowedZones = activeZones.filter(z => z.allow_delivery);

        // Find the fallback radius (the largest one) to use when distance exceeds all defined rules
        const radiusZonesGroup = allowedZones.filter(z => z.zone_type === 'radius' && z.max_radius_km);
        let maxRadiusZone: ShippingZone | null = null;
        if (radiusZonesGroup.length > 0) {
            radiusZonesGroup.sort((a, b) => (b.max_radius_km || 0) - (a.max_radius_km || 0));
            maxRadiusZone = radiusZonesGroup[0];
        }

        for (const zone of allowedZones) {
            // Caso Polígono
            if (zone.zone_type === 'polygon' && this.isPointInPolygon(clientLocation, zone.polygon)) {
                eligibleZones.push(zone);
                continue;
            }

            // Caso Radio
            if (zone.zone_type === 'radius' && zone.max_radius_km && distanceKm !== null) {
                if (distanceKm <= zone.max_radius_km) {
                    eligibleZones.push(zone);
                } else if (zone.id === maxRadiusZone?.id) {
                    // Fallback logic (requested by user): 
                    // If address is beyond all radii, use the tariff of the largest one.
                    logger.info(`[LocationService] Fallback detected: dist ${distanceKm.toFixed(2)}km > max radius ${zone.max_radius_km}km. Using "${zone.name}" price.`);
                    eligibleZones.push(zone);
                }
            }
        }

        if (eligibleZones.length === 0) {
            return { 
                zone: null, 
                distance_km: distanceKm,
                allowed: false,
                error: `Lamentablemente estás a ${distanceKm?.toFixed(1) || 'varios'} km y no llegamos hasta ahí con el delivery, pero si querés podés pedir para retirar por el local.`
            };
        }

        // Devolver la zona: Priorizamos RADIUS (por cuadras) si existe, 
        // de lo contrario la más barata aplicable.
        const radiusZones = eligibleZones.filter(z => z.zone_type === 'radius');
        if (radiusZones.length > 0) {
            // Entre los radios que cubren la distancia, elegimos el de menor radio (el más ajustado)
            radiusZones.sort((a, b) => (a.max_radius_km || 0) - (b.max_radius_km || 0));
            return { zone: radiusZones[0], distance_km: distanceKm, allowed: true };
        }

        // Si no hay radios, usamos polígonos ordenados por costo
        eligibleZones.sort((a, b) => a.cost - b.cost);
        return { zone: eligibleZones[0], distance_km: distanceKm, allowed: true };
    }
}

