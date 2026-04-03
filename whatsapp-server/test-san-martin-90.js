
const axios = require('axios');
require('dotenv').config();

async function test(address) {
    const gmapsKey = process.env.GOOGLE_MAPS_API_KEY;
    const context = "Bahia Blanca";
    const query = `${address}, ${context}`;
    const geoRes = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${gmapsKey}&region=ar`);
    
    if (geoRes.data.status === 'OK') {
        const result = geoRes.data.results[0];
        console.log(`Address: ${address}`);
        console.log("Formatted:", result.formatted_address);
        console.log("Coords:", result.geometry.location);
        
        // Check zones
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY;
        const point = result.geometry.location;
        const { data: zones } = await axios.get(`${supabaseUrl}/rest/v1/shipping_zones?select=*&is_active=eq.true`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });

        for (const zone of zones) {
            const inZone = zone.zone_type === 'polygon' && isPointInPolygon(point, zone.polygon);
            console.log(`Zone: ${zone.name} | Allow Delivery: ${zone.allow_delivery} | INSIDE: ${inZone}`);
        }
    }
}

function isPointInPolygon(point, polygon) {
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

test("san martin 90");
