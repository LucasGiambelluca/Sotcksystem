import axios from 'axios';

export interface GeoLocation {
    lat: number;
    lng: number;
    address: string;
}

export class GeocodingService {
    private static apiKey = process.env.GOOGLE_MAPS_API_KEY;

    /**
     * Convierte una dirección de texto en coordenadas GPS usando Google Maps Geocoding API.
     */
    public static async geocode(address: string, context?: string): Promise<GeoLocation | null> {
        if (!this.apiKey) {
            throw new Error('No Google Maps API Key found in .env');
        }

        try {
            const query = context ? `${address}, ${context}` : address;
            console.log('[Geocoding] Searching for:', query);

            const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
                params: {
                    address: query,
                    key: this.apiKey,
                    language: 'es',
                    region: 'ar'
                }
            });

            if (response.data.status !== 'OK' || response.data.results.length === 0) {
                console.warn('[Geocoding] No results or error for:', query);
                console.warn('[Geocoding] Google Status:', response.data.status);
                
                if (response.data.error_message) {
                    console.error('[Geocoding] Google Error Message:', response.data.error_message);
                }
                return null; // Return null instead of throwing to allow flow engine to handle failure gracefully
            }

            const result = response.data.results[0];
            return {
                lat: result.geometry.location.lat,
                lng: result.geometry.location.lng,
                address: result.formatted_address
            };
        } catch (error: any) {
            console.error('[Geocoding] Fatal Error:', error.message);
            return null; // Safe fallback
        }
    }
}
