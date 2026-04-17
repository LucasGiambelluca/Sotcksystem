require('dotenv').config({ path: './.env' });
const { supabase } = require('./src/config/database');
const { LocationService } = require('./src/services/LocationService');

async function test() {
    const { data: zones, error } = await supabase.from('shipping_zones').select('*').eq('name', 'VILLA  LORETO');
    
    if (error || !zones || zones.length === 0) {
        console.log('Error or no zone found:', error);
        process.exit(1);
    }
    
    const zone = zones[0];
    const clientLoc = { lat: -38.7365414, lng: -62.2761179 }; // Godoy Cruz 327
    
    console.log('Zone fetched:', zone.name);
    console.log('Polygon:', JSON.stringify(zone.polygon).substring(0, 50) + '...');
    console.log('Client loc:', clientLoc);
    
    const isInside = LocationService.isPointInPolygon(clientLoc, zone.polygon);
    console.log('LocationService.isPointInPolygon returned:', isInside);
    
    process.exit(0);
}

test();
