const https = require('https');
require('dotenv').config();
const fs = require('fs');

const url = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent('chiclana 90, Bahia Blanca, Argentina') + '&key=' + process.env.GOOGLE_MAPS_API_KEY + '&language=es&region=ar';

https.get(url, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        const json = JSON.parse(data);
        if (json.results && json.results.length > 0) {
            console.log('--- OUTPUT ---');
            console.log(JSON.stringify(json.results[0].geometry.location, null, 2));

            // Also check the inside logic
            const pt = json.results[0].geometry.location;
            const geojsonRaw = fs.readFileSync('../client/src/data/bahia-neighborhoods.json', 'utf8');
            const mapData = JSON.parse(geojsonRaw);
            
            function isPointInPolygon(point, geojson) {
                const checkRing = (coords) => {
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
                if (geojson.type === 'Polygon') return checkRing(geojson.coordinates[0]);
                if (geojson.type === 'MultiPolygon') return geojson.coordinates.some(c => checkRing(c[0]));
                return false;
            }

            const inFeatures = mapData.features.filter(f => isPointInPolygon(pt, f.geometry));
            console.log('Matches:', inFeatures.map(f => f.properties.name));
            console.log('--- END ---');
        } else {
            console.log('No results found from Google API.');
            console.log(data);
        }
    });
}).on('error', (e) => {
    console.error(e);
});
