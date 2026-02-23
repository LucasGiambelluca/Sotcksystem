import axios from 'axios';

interface GeocodeResult {
  lat: number;
  lng: number;
  formatted: string;
  place_id: string;
  fromCache: boolean;
}

export class GeocodingService {
  private apiKey: string;
  private cache: Map<string, GeocodeResult> = new Map();
  private readonly REGION = 'ar'; // Argentina
  private readonly LANGUAGE = 'es';

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ GOOGLE_MAPS_API_KEY is not set. Geocoding will fail.');
    }
  }

  /**
   * Geocodes an address string to coordinates.
   * Uses in-memory cache to save API calls.
   */
  /**
   * Clean an address by removing duplicate parts and redundant context.
   * e.g., "punta alta 428, bahia blanca, bahia blanca, buenos aires, argentina, provincia de buenos aires"
   *    -> "punta alta 428, bahia blanca"
   */
  private cleanAddress(raw: string): { street: string; city: string } {
    let addr = raw.toLowerCase().trim();

    // Remove known noise phrases
    const noisePatterns = [
      /provincia de buenos aires/gi,
      /buenos aires/gi,
      /argentina/gi,
      /cuartel [iv]+/gi,
      /partido de bah[ií]a blanca/gi,
      /b\d{4}[a-z]{3}/gi,  // postal codes like B8000GYB
    ];
    for (const p of noisePatterns) {
      addr = addr.replace(p, '');
    }

    // Split by comma, trim, deduplicate, remove empties
    const parts = addr
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // Deduplicate (case-insensitive)
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const part of parts) {
      const key = part.toLowerCase().replace(/\s+/g, ' ');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(part);
      }
    }

    // The first part is typically the street+number
    const street = unique[0] || raw;
    // Detect city from remaining parts or default
    const city = unique.find(p => 
      p.includes('bahia blanca') || p.includes('bahía blanca') || p.includes('white') || p.includes('cerri')
    ) || 'Bahia Blanca';

    return { street, city };
  }

    async geocodeAddress(address: string): Promise<GeocodeResult> {
    const normalizedKey = address.toLowerCase().trim();

    // 1. Check Cache
    if (this.cache.has(normalizedKey)) {
      const cached = this.cache.get(normalizedKey)!;
      return { ...cached, fromCache: true };
    }

    const { street, city } = this.cleanAddress(address);
    let result: GeocodeResult | null = null;

    // 2. Try Nominatim (Free)
    try {
        result = await this.geocodeNominatim(street, city);
    } catch (e) {
        console.warn(`[Geocoding] Nominatim failed/empty for "${street}", trying fallback...`);
    }

    // 3. Fallback to Google (Paid)
    if (!result && this.apiKey) {
        try {
            result = await this.geocodeGoogle(street, city);
        } catch (e) {
            console.error(`[Geocoding] Google fallback failed: ${e}`);
        }
    }

    if (!result) {
        throw new Error('No se pudo geocodificar la dirección en ningún proveedor.');
    }

    // 4. Save to Cache
    this.cache.set(normalizedKey, result);
    console.log(`[Geocoding] ✅ "${street}" -> (${result.lat}, ${result.lng}) via ${this.apiKey && !result.place_id.startsWith('osm') ? 'Google' : 'Nominatim'}`);
    
    return result;
  }

  private async geocodeNominatim(street: string, city: string): Promise<GeocodeResult> {
      console.log(`[Geocoding] Nominatim structured: street="${street}", city="${city}"`);
      // Rate limit manually if not using a queue
      await new Promise(r => setTimeout(r, 1100));

      let response = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
              street: street,
              city: city,
              country: 'Argentina',
              format: 'json',
              limit: 1,
              addressdetails: 1,
              'accept-language': 'es-AR'
          },
          headers: { 'User-Agent': 'StockSystem-Logistics/1.0' }
      });

      if (!response.data || response.data.length === 0) {
          // Retry with free text
          console.log(`[Geocoding] Nominatim retry free-text...`);
          await new Promise(r => setTimeout(r, 1100));
           response = await axios.get('https://nominatim.openstreetmap.org/search', {
              params: {
                  q: `${street}, ${city}, Argentina`,
                  format: 'json',
                  limit: 1,
                  addressdetails: 1,
                  'accept-language': 'es-AR'
              },
              headers: { 'User-Agent': 'StockSystem-Logistics/1.0' }
          });
      }

      if (!response.data || response.data.length === 0) {
          throw new Error('No results from Nominatim');
      }

      const item = response.data[0];
      return {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          formatted: item.display_name,
          place_id: `osm:${item.place_id}`,
          fromCache: false
      };
  }

  private async geocodeGoogle(street: string, city: string): Promise<GeocodeResult> {
      console.log(`[Geocoding] Google Maps: street="${street}", city="${city}"`);
      const searchAddress = `${street}, ${city}, Buenos Aires, Argentina`;
      
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json`,
        {
            params: {
                address: searchAddress,
                key: this.apiKey,
                region: this.REGION,
                language: this.LANGUAGE,
                components: 'locality:Bahia Blanca|country:AR'
            }
        }
      );

      if (response.data.status !== 'OK' || response.data.results.length === 0) {
          throw new Error(`Google status: ${response.data.status}`);
      }

      const item = response.data.results[0];
      return {
          lat: item.geometry.location.lat,
          lng: item.geometry.location.lng,
          formatted: item.formatted_address,
          place_id: item.place_id,
          fromCache: false
      };
  }

  /**
   * Batch geocoding (Sequence of updates)
   * Note: Google Directions API has a limit of ~25 waypoints, but we might have more orders.
   * This function ensures we have coords for all of them.
   */
  async geocodeBatch(addresses: string[]): Promise<Map<string, GeocodeResult>> {
    const results = new Map<string, GeocodeResult>();
    const uniqueAddresses = [...new Set(addresses)]; // Deduplicate to save costs

    // Sequential execution to avoid Rate Limiting (though Axios can handle concurrent, 
    // it's safer to not burst 100 requests)
    // We can do chunks of 5
    const chunkSize = 5;
    for (let i = 0; i < uniqueAddresses.length; i += chunkSize) {
      const chunk = uniqueAddresses.slice(i, i + chunkSize);
      
      const promises = chunk.map(async (addr) => {
        try {
          const res = await this.geocodeAddress(addr);
          results.set(addr, res);
        } catch (e) {
          console.warn(`Skipping address "${addr}" due to error.`);
        }
      });

      await Promise.all(promises);
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 200)); 
    }

    return results;
  }
}
