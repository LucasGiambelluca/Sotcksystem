

export interface LatLng {
    lat: number;
    lng: number;
}

export interface ShippingZone {
    id: string;
    name: string;
    zone_type: 'radius' | 'text_match';
    max_radius_km: number | null;
    match_keywords: string | null;
    cost: number;
    is_active: boolean;
}

export class LocationService {
    /**
     * Calcula la distancia en línea recta entre dos puntos GPS usando la fórmula Haversine.
     */
    private static calculateHaversineDistance(point1: LatLng, point2: LatLng): number {
        const R = 6371; // Radio de la Tierra en km
        const dLat = this.deg2rad(point2.lat - point1.lat);
        const dLng = this.deg2rad(point2.lng - point1.lng);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(point1.lat)) * Math.cos(this.deg2rad(point2.lat)) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c; // Distancia en km
        return distance;
    }

    private static deg2rad(deg: number): number {
        return deg * (Math.PI/180);
    }

    /**
     * Estima la distancia real de conducción aplicando un multiplicador urbano (Manhattan factor).
     */
    public static calculateRoutingDistance(point1: LatLng, point2: LatLng, multiplier: number = 1.3): number {
        const linearDistance = this.calculateHaversineDistance(point1, point2);
        return linearDistance * multiplier;
    }

    /**
     * Calcula la distancia de Levenshtein entre dos cadenas de texto.
     */
    private static getLevenshteinDistance(a: string, b: string): number {
        if (!a.length) return b.length;
        if (!b.length) return a.length;
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
                }
            }
        }
        return matrix[b.length][a.length];
    }

    /**
     * Búsqueda difusa manual tolerante a fallos.
     */
    private static isFuzzyMatch(text: string, keyword: string, maxTypos: number = 2): boolean {
        text = text.toLowerCase();
        keyword = keyword.toLowerCase();
        if (text.includes(keyword)) return true;
        
        // Comprobar palabras individuales por Levenshtein (ej. " Universitario" contra "Universitario")
        const words = text.split(/[\s,.-]+/);
        for (const word of words) {
            if (this.getLevenshteinDistance(word, keyword) <= maxTypos) return true;
        }
        return false;
    }

    /**
     * Determina la zona de envío más económica que cubra la distancia o coincida con el texto.
     */
    public static determineShippingZone(
        zones: ShippingZone[], 
        clientLocation?: LatLng, 
        storeLocation?: LatLng,
        addressText?: string
    ): { zone: ShippingZone | null, distance_km: number | null, error?: string } {
        
        const activeZones = zones.filter(z => z.is_active);
        if (activeZones.length === 0) {
            return { zone: null, distance_km: null, error: 'No hay zonas de envío configuradas.' };
        }

        let distanceKm = null;
        let eligibleZones: ShippingZone[] = [];

        // 1. Evaluar zonas por Radio GPS
        if (clientLocation && storeLocation && storeLocation.lat && storeLocation.lng) {
            distanceKm = this.calculateRoutingDistance(storeLocation, clientLocation);
            
            const radiusZones = activeZones.filter(z => z.zone_type === 'radius' && z.max_radius_km !== null);
            for (const zone of radiusZones) {
                if (distanceKm <= zone.max_radius_km!) {
                    eligibleZones.push(zone);
                }
            }
        }

        // 2. Evaluar zonas por Texto (Fuzzy Matching)
        if (addressText) {
            const textZones = activeZones.filter(z => z.zone_type === 'text_match' && z.match_keywords);
            if (textZones.length > 0) {
                // Preparar los keywords para Fuse
                const zoneKeywords = textZones.map(z => {
                    const keywords = z.match_keywords!.split(',').map(k => k.trim());
                    return { id: z.id, keywords, zone: z };
                });

                // Invertimos la lógica: Buscamos si el texto del cliente contiene algún keyword nuestro (Fuzzy Match).
                for (const item of zoneKeywords) {
                    let matched = false;
                    for (const kw of item.keywords) {
                        if (this.isFuzzyMatch(addressText, kw)) {
                            matched = true;
                            break;
                        }
                    }
                    if (matched) eligibleZones.push(item.zone);
                }
            }
        }

        if (eligibleZones.length === 0) {
            return { 
                zone: null, 
                distance_km: distanceKm,
                error: distanceKm 
                    ? `Estás a ${distanceKm.toFixed(1)}km, fuera del área de reparto.`
                    : 'La dirección no coincide con ninguna zona de envío.'
            };
        }

        // Devolver la zona más barata aplicable (Beneficio para el cliente)
        eligibleZones.sort((a, b) => a.cost - b.cost);
        return { zone: eligibleZones[0], distance_km: distanceKm };
    }
}
