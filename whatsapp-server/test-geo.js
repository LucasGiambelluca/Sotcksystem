
const axios = require('axios');
require('dotenv').config();

// Simple mock/extract of relevant logic to avoid import hell in a scratch script
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

    static calculateHaversineDistance(point1, point2) {
        const R = 6371;
        const dLat = (point2.lat - point1.lat) * Math.PI / 180;
        const dLng = (point2.lng - point1.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    static determineShippingZone(zones, clientLoc, storeLoc) {
        const activeZones = zones.filter(z => z.is_active);
        const forbiddenZones = activeZones.filter(z => !z.allow_delivery);
        for (const zone of forbiddenZones) {
            if (zone.zone_type === 'polygon' && this.isPointInPolygon(clientLoc, zone.polygon)) return { allowed: false, error: `Forbidden: ${zone.name}`, zone };
        }
        const allowedZones = activeZones.filter(z => z.allow_delivery);
        let eligible = [];
        for (const zone of allowedZones) {
            if (zone.zone_type === 'polygon' && this.isPointInPolygon(clientLoc, zone.polygon)) eligible.push(zone);
            if (zone.zone_type === 'radius' && storeLoc && zone.max_radius_km) {
                if (this.calculateHaversineDistance(storeLoc, clientLoc) <= zone.max_radius_km) eligible.push(zone);
            }
        }
        if (eligible.length === 0) return { allowed: false, error: 'Out of zones' };
        eligible.sort((a,b) => a.cost - b.cost);
        return { allowed: true, zone: eligible[0] };
    }
}

async function test() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    const gmapsKey = process.env.GOOGLE_MAPS_API_KEY;

    console.log("--- GOOGLE GEOCODING ---");
    const address = "san martin 10";
    const geoRes = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${gmapsKey}&region=ar`);
    if (geoRes.data.status !== 'OK') {
        console.log("Geocoding failed:", geoRes.data.status);
        return;
    }
    const geo = {
        lat: geoRes.data.results[0].geometry.location.lat,
        lng: geoRes.data.results[0].geometry.location.lng,
        address: geoRes.data.results[0].formatted_address
    };
    console.log("Result:", geo);

    console.log("\n--- DB STATE ---");
    const { data: config } = await axios.get(`${supabaseUrl}/rest/v1/whatsapp_config?select=store_lat,store_lng`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
    const { data: zones } = await axios.get(`${supabaseUrl}/rest/v1/shipping_zones?select=*&is_active=eq.true`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });

    const storeLoc = { lat: config[0].store_lat, lng: config[0].store_lng };
    console.log("Store Location:", storeLoc);
    console.log("Active Zones:", zones.map(z => `${z.name} (${z.allow_delivery ? 'Allowed' : 'FORBIDDEN'})`));

    console.log("\n--- VALIDATION ---");
    const result = LocationService.determineShippingZone(zones, geo, storeLoc);
    console.log("Decision:", result.allowed ? "ALLOWED ✅" : "BLOCKED ❌", result.error || "");
    if (result.zone) console.log("Matched Zone:", result.zone.name);
}

test();
