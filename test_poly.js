const fs = require('fs');

const point = { lat: -38.7186095, lng: -62.2658254 }; // chiclana 60

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
    };

    if (geojson.type === 'Polygon') return checkRing(geojson.coordinates[0]);
    if (geojson.type === 'MultiPolygon') {
        return geojson.coordinates.some(polygonCoords => checkRing(polygonCoords[0]));
    }
    return false;
}

const data = JSON.parse(fs.readFileSync('./client/src/data/bahia-neighborhoods.json', 'utf8'));

// The user might have meant a variation of Loreto
const loretos = data.features.filter(f => f.properties.name.toUpperCase().includes('LORETO'));

console.log("Found matches for LORETO:", loretos.map(f => f.properties.name));

for (const feature of loretos) {
    const isInside = isPointInPolygon(point, feature.geometry);
    console.log(`Is Chiclana 60 inside ${feature.properties.name}?`, isInside);
}

// Let's also check all features to see which one chiclana 60 is actually inside!
const insideFeatures = data.features.filter(f => isPointInPolygon(point, f.geometry));
console.log("Chiclana 60 is actually inside:", insideFeatures.map(f => f.properties.name));
