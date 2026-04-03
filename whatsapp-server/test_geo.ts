import dotenv from 'dotenv';
dotenv.config();
import { GeocodingService } from './src/services/GeocodingService';

async function test() {
    console.log('Testing Geocoding with API Key:', process.env.GOOGLE_MAPS_API_KEY);
    const result = await GeocodingService.geocode('cramer 330, Bahia Blanca');
    console.log('Result:', result);
}
test();
