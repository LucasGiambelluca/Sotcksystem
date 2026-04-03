import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const kmlPath = path.join(__dirname, 'bahia-barrios.kml');
const jsonPath = path.join(__dirname, 'bahia-neighborhoods.json');

function convert() {
    console.log('Starting KML to GeoJSON conversion...');
    const kml = fs.readFileSync(kmlPath, 'utf8');

    const placemarks = kml.split('<Placemark>');
    placemarks.shift(); // Remove content before first Placemark

    const features = placemarks.map(pm => {
        const nameMatch = pm.match(/<name>(.*?)<\/name>/);
        const coordsMatch = pm.match(/<coordinates>\s*([\s\S]*?)\s*<\/coordinates>/);

        if (!nameMatch || !coordsMatch) return null;

        const name = nameMatch[1].trim();
        const coordsRaw = coordsMatch[1].trim();
        
        // Split by whitespace and then by comma
        const points = coordsRaw.split(/\s+/).map(p => {
            const parts = p.split(',');
            if (parts.length < 2) return null;
            const lng = Number(parts[0]);
            const lat = Number(parts[1]);
            return [lng, lat];
        }).filter(p => p !== null && !isNaN(p[0]) && !isNaN(p[1]));

        // GeoJSON Polygon coordinates are a nested array (ring)
        return {
            type: 'Feature',
            properties: { name },
            geometry: {
                type: 'Polygon',
                coordinates: [points]
            }
        };
    }).filter(f => f !== null);

    const geojson = {
        type: 'FeatureCollection',
        features
    };

    fs.writeFileSync(jsonPath, JSON.stringify(geojson, null, 2));
    console.log(`✅ Conversion complete! Saved ${features.length} neighborhoods to ${jsonPath}`);
}

convert();
