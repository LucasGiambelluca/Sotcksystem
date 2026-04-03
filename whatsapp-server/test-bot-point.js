
const axios = require('axios');
require('dotenv').config();

class LocationService {
    static isPointInPolygon(point, polygon) {
        if (!polygon || !polygon.coordinates || polygon.coordinates.length === 0) return false;
        const coords = polygon.coordinates[0];
        let inside = false;
        for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
            const xi = coords[i][1], yi = coords[i][0];
            const xj = coords[j][1], yj = coords[j][0];
            const intersect = ((yi > point.lng) !== (yj > point.lng))
                && (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
}

async function test() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    // The exact point from the bot logs:
    const point = { lat: -38.7183177, lng: -62.2663478 }; 

    console.log("Testing Point from Bot Logs:", point);
    const { data: zones } = await axios.get(`${supabaseUrl}/rest/v1/shipping_zones?select=*&is_active=eq.true`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });

    for (const zone of zones) {
        const inZone = zone.zone_type === 'polygon' && LocationService.isPointInPolygon(point, zone.polygon);
        console.log(`Zone: ${zone.name} | Allow Delivery: ${zone.allow_delivery} | INSIDE: ${inZone}`);
    }
}

test();
